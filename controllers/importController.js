const { randomUUID } = require('crypto');
const path = require('path');
const tableImporter = require('../services/tableImporter');
const writeTempFile = require('../db_apis/writeTempFile');
const mapper = require('../config/mapper');

/**
 * Extrae el buffer binario del cuerpo de la petición HTTP.
 * Admite:
 * 1. Stream binario directo (application/octet-stream, multipart, etc.)
 * 2. Buffer ya parseado en req.body
 * 3. JSON con campo fileBase64
 */
async function getBufferFromRequest(req, maxBytes = 50 * 1024 * 1024) {
    if (Buffer.isBuffer(req.body)) {
        return req.body;
    }

    if (req.body && typeof req.body === 'object' && req.body.fileBase64) {
        return Buffer.from(req.body.fileBase64, 'base64');
    }

    return new Promise((resolve, reject) => {
        const chunks = [];
        let total = 0;

        req.on('data', chunk => {
            chunks.push(chunk);
            total += chunk.length;

            if (total > maxBytes) {
                req.pause();
                const err = new Error(`El archivo supera el tamaño máximo permitido (${Math.round(maxBytes / 1024 / 1024)}MB)`);
                err.statusCode = 413;
                reject(err);
            }
        });

        req.on('end', () => {
            resolve(Buffer.concat(chunks, total));
        });

        req.on('error', err => reject(err));
    });
}

/**
 * POST /api/import/preview
 * Recibe un archivo Excel o CSV, lo procesa y devuelve la previsualización y lista de hojas/columnas.
 */
async function preview(req, res, next) {
    try {
        const rawFileName = req.headers['x-file-name'] || req.query.fileName || 'archivo.xlsx';
        const fileName = decodeURIComponent(rawFileName);
        const requestedSheet = req.query.sheet || null;

        const buffer = await getBufferFromRequest(req);
        if (!buffer || buffer.length === 0) {
            return res.status(400).json({ error: 'No se recibieron datos de archivo' });
        }

        const parsed = tableImporter.parseSpreadsheet(buffer, {
            sheetName: requestedSheet,
            maxPreviewRows: 10
        });

        const uploadId = randomUUID();
        const tempPayload = JSON.stringify({
            uploadId,
            fileName,
            sheets: parsed.sheets,
            selectedSheet: parsed.selectedSheet,
            columns: parsed.columns,
            totalRows: parsed.totalRows,
            rows: parsed.rows
        });

        await writeTempFile.writeFile(tempPayload, `${uploadId}.json`);

        res.status(200).json({
            uploadId,
            fileName,
            sheets: parsed.sheets,
            selectedSheet: parsed.selectedSheet,
            columns: parsed.columns,
            totalRows: parsed.totalRows,
            preview: parsed.preview
        });

    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/import/execute
 * Toma los datos parseados previamente y los inserta en la tabla destino de Oracle.
 */
async function execute(req, res, next) {
    let tempFilename = null;
    try {
        const {
            uploadId,
            tableName,
            mapping,
            defaults = {},
            truncate = false,
            atomic = true,
            batchSize = 2000
        } = req.body || {};

        if (!uploadId || !/^[a-f0-9-]{36}$/i.test(uploadId)) {
            return res.status(400).json({ error: 'Identificador uploadId inválido o no provisto' });
        }

        if (!tableName) {
            return res.status(400).json({ error: 'Debe especificar el nombre de la tabla destino' });
        }

        tempFilename = `${uploadId}.json`;
        let storedData;
        try {
            storedData = await writeTempFile.readJson(tempFilename);
        } catch (readErr) {
            return res.status(404).json({ error: 'La sesión de importación expiró o el archivo no existe. Vuelve a subir el archivo.' });
        }

        if (!storedData || !Array.isArray(storedData.rows) || storedData.rows.length === 0) {
            return res.status(400).json({ error: 'El archivo subido no contiene registros para importar' });
        }

        const result = await tableImporter.executeImport({
            tableName,
            rows: storedData.rows,
            mapping: mapping || {},
            defaults,
            truncate: Boolean(truncate),
            atomic: atomic !== false,
            batchSize: Number(batchSize) || 2000
        });

        res.status(200).json(result);

    } catch (err) {
        next(err);
    } finally {
        if (tempFilename) {
            await writeTempFile.removeFile(tempFilename);
        }
    }
}

/**
 * POST /api/import/direct
 * Carga e importa directamente en una sola petición (ideal para curl o integraciones automáticas).
 */
async function directImport(req, res, next) {
    try {
        const tableName = req.headers['x-table-name'] || req.query.tableName;
        if (!tableName) {
            return res.status(400).json({ error: 'La cabecera X-Table-Name o parámetro tableName es requerido' });
        }

        const truncate = req.headers['x-truncate'] === 'true' || req.query.truncate === 'true';
        const atomic = req.headers['x-atomic'] !== 'false' && req.query.atomic !== 'false';
        const sheetName = req.headers['x-sheet-name'] || req.query.sheet || null;

        const buffer = await getBufferFromRequest(req);
        if (!buffer || buffer.length === 0) {
            return res.status(400).json({ error: 'No se recibieron datos de archivo' });
        }

        const parsed = tableImporter.parseSpreadsheet(buffer, { sheetName });
        if (parsed.rows.length === 0) {
            return res.status(400).json({ error: 'El archivo no contiene filas con datos' });
        }

        // Consultar columnas de la tabla para auto-mapear
        let tableCols = [];
        try {
            tableCols = await tableImporter.getTableColumns(tableName);
        } catch (e) {
            console.warn('No se pudieron obtener columnas de la tabla para auto-mapping:', e.message);
        }

        const tableColNames = new Set(tableCols.map(c => c.name.toUpperCase()));

        // Auto-mapeo: mapea columnas del archivo cuyos nombres coincidan con las de la tabla
        const mapping = {};
        parsed.columns.forEach(col => {
            const normalized = col.trim().toUpperCase();
            if (tableColNames.size === 0 || tableColNames.has(normalized)) {
                mapping[col] = normalized;
            }
        });

        if (Object.keys(mapping).length === 0) {
            return res.status(400).json({
                error: 'Ninguna columna del archivo coincide con las columnas de la tabla destino',
                fileColumns: parsed.columns,
                tableColumns: Array.from(tableColNames)
            });
        }

        const result = await tableImporter.executeImport({
            tableName,
            rows: parsed.rows,
            mapping,
            truncate,
            atomic
        });

        res.status(200).json({
            ...result,
            mappedColumns: mapping
        });

    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/import/tables
 * Retorna las tablas disponibles en la base de datos o en los catálogos.
 */
async function getTables(req, res, next) {
    try {
        let tables = await tableImporter.getAllTables();
        if (tables.length === 0 && mapper && mapper.jsonEntityMap) {
            tables = Object.keys(mapper.jsonEntityMap).sort();
        }
        res.status(200).json({ tables });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/import/table-columns/:table
 * Retorna la metadata de columnas de una tabla dada en Oracle.
 */
async function getTableColumns(req, res, next) {
    try {
        const tableName = req.params.table;
        if (!tableName) {
            return res.status(400).json({ error: 'El nombre de tabla es requerido' });
        }

        const columns = await tableImporter.getTableColumns(tableName);
        res.status(200).json({
            tableName: tableName.toUpperCase(),
            columns
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    preview,
    execute,
    directImport,
    getTables,
    getTableColumns
};
