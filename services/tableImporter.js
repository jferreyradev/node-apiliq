const xlsx = require('xlsx');
const oracledb = require('oracledb');
const database = require('./database');

/**
 * Valida que un identificador de Oracle (tabla o esquema.tabla) sea seguro contra SQL Injection.
 */
function validateIdentifier(name) {
    if (!name || typeof name !== 'string') {
        throw new Error('El nombre de tabla no puede estar vacío');
    }
    const clean = name.trim();
    if (!/^[A-Za-z0-9_#$]+(\.[A-Za-z0-9_#$]+)?$/.test(clean)) {
        throw new Error(`Nombre de tabla inválido o no seguro: "${name}"`);
    }
    return clean;
}

/**
 * Valida que un nombre de columna de Oracle sea seguro.
 */
function validateColumnName(name) {
    if (!name || typeof name !== 'string') {
        throw new Error('El nombre de columna no puede estar vacío');
    }
    const clean = name.trim();
    if (!/^[A-Za-z0-9_#$]+$/.test(clean)) {
        throw new Error(`Nombre de columna inválido o no seguro: "${name}"`);
    }
    return clean;
}

/**
 * Parsea un archivo Excel (.xlsx, .xls) o CSV / TXT desde un Buffer en memoria.
 */
function parseSpreadsheet(buffer, options = {}) {
    if (!buffer || !Buffer.isBuffer(buffer)) {
        throw new Error('El archivo debe ser provisto como un Buffer binario válido');
    }

    const { sheetName = null, maxPreviewRows = 10, raw = false } = options;

    const workbook = xlsx.read(buffer, {
        type: 'buffer',
        cellDates: true,
        raw: raw
    });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('El archivo no contiene ninguna hoja válida');
    }

    const selectedSheet = (sheetName && workbook.SheetNames.includes(sheetName)) 
        ? sheetName 
        : workbook.SheetNames[0];

    const worksheet = workbook.Sheets[selectedSheet];
    if (!worksheet) {
        throw new Error(`La hoja "${selectedSheet}" no fue encontrada en el archivo`);
    }

    // Convertir la hoja a objetos JSON
    const rows = xlsx.utils.sheet_to_json(worksheet, {
        defval: null,
        blankrows: false
    });

    // Extraer lista única de nombres de columnas
    let columns = [];
    if (worksheet['!ref']) {
        const range = xlsx.utils.decode_range(worksheet['!ref']);
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = xlsx.utils.encode_cell({ c: C, r: range.s.r });
            const cell = worksheet[cellAddress];
            if (cell && cell.v !== undefined && cell.v !== null) {
                columns.push(String(cell.v).trim());
            }
        }
    }

    // Si no se extrajeron por rango, extraer de las claves de las filas
    if (columns.length === 0 && rows.length > 0) {
        const colSet = new Set();
        rows.forEach(r => Object.keys(r).forEach(k => colSet.add(k)));
        columns = Array.from(colSet);
    }

    const preview = rows.slice(0, Math.min(rows.length, maxPreviewRows));

    return {
        sheets: workbook.SheetNames,
        selectedSheet,
        columns,
        totalRows: rows.length,
        preview,
        rows
    };
}

/**
 * Consulta la estructura de columnas de una tabla física en Oracle.
 */
async function getTableColumns(tableName, injectedConnection = null) {
    const cleanTable = validateIdentifier(tableName).toUpperCase();
    let owner = null;
    let table = cleanTable;

    if (cleanTable.includes('.')) {
        const parts = cleanTable.split('.');
        owner = parts[0];
        table = parts[1];
    }

    const query = `
        SELECT column_name, data_type, data_length, data_precision, data_scale, nullable
        FROM all_tab_columns
        WHERE table_name = :tbl
          AND (:owner IS NULL OR owner = :owner)
        ORDER BY column_id
    `;

    const binds = {
        tbl: table,
        owner: owner
    };

    let result;
    if (injectedConnection) {
        result = await injectedConnection.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    } else {
        result = await database.simpleExecute(query, binds);
    }

    if (!result || !result.rows || result.rows.length === 0) {
        return [];
    }

    return result.rows.map(col => ({
        name: col.COLUMN_NAME,
        type: col.DATA_TYPE,
        length: col.DATA_LENGTH,
        precision: col.DATA_PRECISION,
        scale: col.DATA_SCALE,
        nullable: col.NULLABLE === 'Y'
    }));
}

/**
 * Obtiene la lista de tablas disponibles en la base de datos Oracle.
 */
async function getAllTables(injectedConnection = null) {
    try {
        const query = `
            SELECT table_name 
            FROM user_tables 
            ORDER BY table_name
        `;
        let result;
        if (injectedConnection) {
            result = await injectedConnection.execute(query, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        } else {
            result = await database.simpleExecute(query);
        }

        if (result && result.rows && result.rows.length > 0) {
            return result.rows.map(r => r.TABLE_NAME);
        }
        return [];
    } catch (err) {
        console.warn('No se pudo listar user_tables desde Oracle:', err.message);
        return [];
    }
}

/**
 * Construye la sentencia SQL INSERT parametrizada y los bindDefs para executeMany.
 */
function buildInsertPlan({ tableName, mapping, tableColumns = [] }) {
    const cleanTable = validateIdentifier(tableName);

    if (!mapping || typeof mapping !== 'object' || Object.keys(mapping).length === 0) {
        throw new Error('Debe proporcionar un mapeo de columnas válido');
    }

    // Filtrar columnas ignoradas o vacías
    const activeMappings = [];
    for (const [fileCol, targetCol] of Object.entries(mapping)) {
        if (targetCol && targetCol !== '(ignorar)' && targetCol !== 'ignore') {
            const cleanTarget = validateColumnName(targetCol).toUpperCase();
            activeMappings.push({
                fileCol,
                targetCol: cleanTarget
            });
        }
    }

    if (activeMappings.length === 0) {
        throw new Error('No se definió ninguna columna de destino para insertar');
    }

    const tableColMap = new Map();
    tableColumns.forEach(c => tableColMap.set(c.name.toUpperCase(), c));

    const insertCols = [];
    const bindParams = [];
    const bindDefs = {};

    activeMappings.forEach((m, idx) => {
        const paramName = `b_${idx}`;
        insertCols.push(m.targetCol);
        bindParams.push(`:${paramName}`);

        const colMeta = tableColMap.get(m.targetCol);
        if (colMeta) {
            const dt = colMeta.type.toUpperCase();
            if (dt.includes('NUMBER') || dt.includes('FLOAT') || dt.includes('DECIMAL')) {
                bindDefs[paramName] = { type: oracledb.NUMBER };
            } else if (dt.includes('DATE') || dt.includes('TIMESTAMP')) {
                bindDefs[paramName] = { type: oracledb.DATE };
            } else {
                bindDefs[paramName] = {
                    type: oracledb.STRING,
                    maxSize: Math.max(colMeta.length || 4000, 4000)
                };
            }
        } else {
            bindDefs[paramName] = {
                type: oracledb.STRING,
                maxSize: 4000
            };
        }
    });

    const sql = `INSERT INTO ${cleanTable} (${insertCols.join(', ')}) VALUES (${bindParams.join(', ')})`;

    return {
        sql,
        activeMappings,
        bindDefs
    };
}

/**
 * Convierte un arreglo de filas en el formato de binds esperado por oracledb.executeMany.
 */
function transformRowsToBinds(rows, activeMappings, defaults = {}) {
    return rows.map(row => {
        const bindRow = {};
        activeMappings.forEach((m, idx) => {
            const paramName = `b_${idx}`;
            let val = row[m.fileCol];

            if (val === undefined || val === '' || val === null) {
                if (defaults && defaults[m.targetCol] !== undefined) {
                    val = defaults[m.targetCol];
                } else {
                    val = null;
                }
            } else if (typeof val === 'string') {
                val = val.trim();
                if (val === '') val = null;
            }

            bindRow[paramName] = val;
        });
        return bindRow;
    });
}

/**
 * Ejecuta la importación por lotes en Oracle.
 */
async function executeImport(params) {
    const {
        tableName,
        rows,
        mapping,
        defaults = {},
        truncate = false,
        atomic = true,
        batchSize = 2000,
        injectedConnection = null
    } = params;

    const startTime = Date.now();
    const cleanTable = validateIdentifier(tableName);

    if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error('No hay filas para importar');
    }

    const conn = injectedConnection || await database.getConnection();
    let committed = false;

    try {
        // 1. Obtener metadatos de columnas de la tabla para optimizar los binds
        const tableColumns = await getTableColumns(cleanTable, conn);

        // 2. Construir plan de inserción
        const { sql, activeMappings, bindDefs } = buildInsertPlan({
            tableName: cleanTable,
            mapping,
            tableColumns
        });

        // 3. Truncar o vaciar tabla si fue solicitado
        if (truncate) {
            try {
                await conn.execute(`TRUNCATE TABLE ${cleanTable}`);
            } catch (err) {
                console.warn(`TRUNCATE TABLE ${cleanTable} falló (${err.message}). Intentando DELETE FROM...`);
                await conn.execute(`DELETE FROM ${cleanTable}`);
            }
        }

        // 4. Transformar filas a formato binds
        const allBinds = transformRowsToBinds(rows, activeMappings, defaults);

        // 5. Inserción por lotes
        let totalRowsAffected = 0;
        const batchErrors = [];
        const executeOptions = {
            autoCommit: false,
            batchErrors: !atomic,
            bindDefs: bindDefs
        };

        for (let i = 0; i < allBinds.length; i += batchSize) {
            const batch = allBinds.slice(i, i + batchSize);
            const result = await conn.executeMany(sql, batch, executeOptions);

            if (result && result.rowsAffected) {
                totalRowsAffected += result.rowsAffected;
            } else {
                totalRowsAffected += batch.length;
            }

            if (result && result.batchErrors && result.batchErrors.length > 0) {
                batchErrors.push(...result.batchErrors);
            }
        }

        if (atomic || batchErrors.length === 0) {
            await conn.commit();
            committed = true;
        }

        const elapsedMs = Date.now() - startTime;

        return {
            success: true,
            tableName: cleanTable,
            totalRows: rows.length,
            rowsInserted: totalRowsAffected,
            batchErrors: batchErrors,
            timeMs: elapsedMs
        };

    } catch (err) {
        if (!committed && conn && typeof conn.rollback === 'function') {
            try {
                await conn.rollback();
            } catch (rbErr) {
                console.error('Error durante rollback de importación:', rbErr.message);
            }
        }
        throw err;
    } finally {
        if (!injectedConnection && conn && typeof conn.close === 'function') {
            try {
                await conn.close();
            } catch (closeErr) {
                console.error('Error al cerrar conexión de importación:', closeErr.message);
            }
        }
    }
}

module.exports = {
    validateIdentifier,
    validateColumnName,
    parseSpreadsheet,
    getTableColumns,
    getAllTables,
    buildInsertPlan,
    transformRowsToBinds,
    executeImport
};
