const test = require('node:test');
const assert = require('node:assert/strict');
const xlsx = require('xlsx');
const oracledb = require('oracledb');
const tableImporter = require('../services/tableImporter');
const writeTempFile = require('../db_apis/writeTempFile');

test('tableImporter - Validaciones de identificadores y nombres de columna', () => {
    // Tablas válidas
    assert.equal(tableImporter.validateIdentifier('STG_NOVEDADES'), 'STG_NOVEDADES');
    assert.equal(tableImporter.validateIdentifier('US_SUELDO.STG_TABLA'), 'US_SUELDO.STG_TABLA');
    assert.equal(tableImporter.validateIdentifier('TABLA$1'), 'TABLA$1');

    // Tablas inválidas (inyección SQL)
    assert.throws(() => tableImporter.validateIdentifier('TABLA; DROP TABLE USERS'), /inválido|seguro/);
    assert.throws(() => tableImporter.validateIdentifier('TABLA--'), /inválido|seguro/);
    assert.throws(() => tableImporter.validateIdentifier('SELECT * FROM DUAL'), /inválido|seguro/);
    assert.throws(() => tableImporter.validateIdentifier('TABLA 123'), /inválido|seguro/);
    assert.throws(() => tableImporter.validateIdentifier(''), /vacío/);

    // Columnas válidas
    assert.equal(tableImporter.validateColumnName('DNI'), 'DNI');
    assert.equal(tableImporter.validateColumnName('APELLIDO_NOMBRE'), 'APELLIDO_NOMBRE');
    assert.equal(tableImporter.validateColumnName('IMP$TOTAL'), 'IMP$TOTAL');

    // Columnas inválidas
    assert.throws(() => tableImporter.validateColumnName('COL; DROP'), /inválido|seguro/);
    assert.throws(() => tableImporter.validateColumnName('COL--'), /inválido|seguro/);
    assert.throws(() => tableImporter.validateColumnName(''), /vacío/);
});

test('tableImporter - Parseo de archivos CSV y Excel en memoria', () => {
    // 1. Archivo CSV simple
    const csvContent = 'DNI,APELLIDO,IMPORTE\n12345678,PEREZ,150000.50\n87654321,GOMEZ,230000.00';
    const csvBuffer = Buffer.from(csvContent, 'utf8');

    const parsedCsv = tableImporter.parseSpreadsheet(csvBuffer);
    assert.equal(parsedCsv.totalRows, 2);
    assert.deepEqual(parsedCsv.columns, ['DNI', 'APELLIDO', 'IMPORTE']);
    assert.equal(parsedCsv.rows[0].DNI, 12345678);
    assert.equal(parsedCsv.rows[0].APELLIDO, 'PEREZ');

    // 2. Archivo Excel con múltiples hojas generado en memoria
    const wb = xlsx.utils.book_new();
    const ws1 = xlsx.utils.json_to_sheet([
        { ID: 1, NOMBRE: 'Juan', ACTIVO: 1 },
        { ID: 2, NOMBRE: 'Maria', ACTIVO: 1 }
    ]);
    const ws2 = xlsx.utils.json_to_sheet([
        { CODIGO: 'A1', DESCRIPCION: 'Adicional 1' }
    ]);
    xlsx.utils.book_append_sheet(wb, ws1, 'Empleados');
    xlsx.utils.book_append_sheet(wb, ws2, 'Conceptos');
    const xlsxBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Parsear hoja por defecto (primera)
    const parsedExcel1 = tableImporter.parseSpreadsheet(xlsxBuffer);
    assert.deepEqual(parsedExcel1.sheets, ['Empleados', 'Conceptos']);
    assert.equal(parsedExcel1.selectedSheet, 'Empleados');
    assert.equal(parsedExcel1.totalRows, 2);
    assert.deepEqual(parsedExcel1.columns, ['ID', 'NOMBRE', 'ACTIVO']);

    // Parsear segunda hoja explícitamente
    const parsedExcel2 = tableImporter.parseSpreadsheet(xlsxBuffer, { sheetName: 'Conceptos' });
    assert.equal(parsedExcel2.selectedSheet, 'Conceptos');
    assert.equal(parsedExcel2.totalRows, 1);
    assert.deepEqual(parsedExcel2.columns, ['CODIGO', 'DESCRIPCION']);
});

test('tableImporter - Construcción del plan de inserción SQL y BindDefs', () => {
    const tableColumns = [
        { name: 'DNI', type: 'NUMBER', length: 22 },
        { name: 'APELLIDO', type: 'VARCHAR2', length: 100 },
        { name: 'FECHA_ALTA', type: 'DATE', length: 7 },
        { name: 'IMPORTE', type: 'NUMBER', length: 22 }
    ];

    const mapping = {
        'Documento': 'DNI',
        'Apellido y Nombre': 'APELLIDO',
        'Sueldo': 'IMPORTE',
        'ColumnaInutil': '(ignorar)'
    };

    const plan = tableImporter.buildInsertPlan({
        tableName: 'STG_EMPLEADOS',
        mapping,
        tableColumns
    });

    assert.equal(
        plan.sql,
        'INSERT INTO STG_EMPLEADOS (DNI, APELLIDO, IMPORTE) VALUES (:b_0, :b_1, :b_2)'
    );
    assert.equal(plan.activeMappings.length, 3);
    assert.equal(plan.bindDefs.b_0.type, oracledb.NUMBER);
    assert.equal(plan.bindDefs.b_1.type, oracledb.STRING);
    assert.equal(plan.bindDefs.b_2.type, oracledb.NUMBER);
});

test('tableImporter - Transformación de filas a binds con saneamiento y defaults', () => {
    const activeMappings = [
        { fileCol: 'Doc', targetCol: 'DNI' },
        { fileCol: 'Nombre', targetCol: 'NOMBRE' },
        { fileCol: 'Estado', targetCol: 'IDESTADO' }
    ];

    const rows = [
        { Doc: '12345678', Nombre: '  Juan Perez  ', Estado: '' },
        { Doc: '87654321', Nombre: '', Estado: 2 }
    ];

    const defaults = {
        IDESTADO: 1,
        NOMBRE: 'SIN NOMBRE'
    };

    const binds = tableImporter.transformRowsToBinds(rows, activeMappings, defaults);

    assert.equal(binds.length, 2);
    // Fila 1: trim de Nombre y default para Estado (era string vacío)
    assert.equal(binds[0].b_0, '12345678');
    assert.equal(binds[0].b_1, 'Juan Perez');
    assert.equal(binds[0].b_2, 1);

    // Fila 2: default para Nombre (era vacío) y valor provisto para Estado
    assert.equal(binds[1].b_0, '87654321');
    assert.equal(binds[1].b_1, 'SIN NOMBRE');
    assert.equal(binds[1].b_2, 2);
});

test('tableImporter - executeImport con conexión simulada (Mock executeMany, commit y rollback)', async () => {
    const executedQueries = [];
    let committed = false;
    let rolledBack = false;

    const mockConnection = {
        execute: async (sql, binds) => {
            executedQueries.push({ sql, binds });
            if (sql.includes('all_tab_columns')) {
                return {
                    rows: [
                        { COLUMN_NAME: 'DNI', DATA_TYPE: 'NUMBER', DATA_LENGTH: 22, DATA_PRECISION: 8, DATA_SCALE: 0, NULLABLE: 'N' },
                        { COLUMN_NAME: 'NOMBRE', DATA_TYPE: 'VARCHAR2', DATA_LENGTH: 50, DATA_PRECISION: null, DATA_SCALE: null, NULLABLE: 'Y' }
                    ]
                };
            }
            return { rowsAffected: 1 };
        },
        executeMany: async (sql, batch, opts) => {
            executedQueries.push({ sql, batchCount: batch.length, opts });
            return { rowsAffected: batch.length, batchErrors: [] };
        },
        commit: async () => {
            committed = true;
        },
        rollback: async () => {
            rolledBack = true;
        },
        close: async () => {}
    };

    const rows = [
        { DNI: '111', NOMBRE: 'Ana' },
        { DNI: '222', NOMBRE: 'Carlos' }
    ];

    const result = await tableImporter.executeImport({
        tableName: 'STG_PERSONAS',
        rows,
        mapping: { DNI: 'DNI', NOMBRE: 'NOMBRE' },
        truncate: true,
        atomic: true,
        injectedConnection: mockConnection
    });

    assert.equal(result.success, true);
    assert.equal(result.rowsInserted, 2);
    assert.equal(committed, true);
    assert.equal(rolledBack, false);

    // Verificar que se ejecutó TRUNCATE y luego executeMany
    const truncateCall = executedQueries.find(q => q.sql && q.sql.includes('TRUNCATE TABLE STG_PERSONAS'));
    assert.ok(truncateCall, 'Debió ejecutar TRUNCATE TABLE');

    const executeManyCall = executedQueries.find(q => q.batchCount === 2);
    assert.ok(executeManyCall, 'Debió ejecutar executeMany con 2 filas');
});

test('tableImporter - executeImport realiza rollback si executeMany falla', async () => {
    let rolledBack = false;

    const failingMockConnection = {
        execute: async (sql) => {
            if (sql.includes('all_tab_columns')) {
                return { rows: [{ COLUMN_NAME: 'DNI', DATA_TYPE: 'NUMBER', DATA_LENGTH: 22 }] };
            }
            return {};
        },
        executeMany: async () => {
            throw new Error('ORA-00001: unique constraint violated');
        },
        commit: async () => {},
        rollback: async () => {
            rolledBack = true;
        },
        close: async () => {}
    };

    await assert.rejects(
        async () => {
            await tableImporter.executeImport({
                tableName: 'STG_PERSONAS',
                rows: [{ DNI: '111' }],
                mapping: { DNI: 'DNI' },
                injectedConnection: failingMockConnection
            });
        },
        /ORA-00001/
    );

    assert.equal(rolledBack, true, 'Debió realizar rollback al fallar');
});

test('tableImporter - Endpoints HTTP en Router', async () => {
    const express = require('express');
    const http = require('node:http');
    const router = require('../services/router');

    const app = express();
    app.use('/api', router);

    const adminKey = process.env.ADMIN_ACCESS_KEY || 'liquid-super-secret-key-2026';

    function execReq({ method = 'GET', url, headers = {}, body = null }) {
        return new Promise(resolve => {
            const req = new http.IncomingMessage();
            req.method = method;
            req.url = url;
            req.headers = { host: 'localhost', 'x-admin-key': adminKey, ...headers };
            req.connection = { remoteAddress: '127.0.0.1' };
            req.socket = req.connection;

            const res = new http.ServerResponse(req);
            let data = '';
            res.write = chunk => {
                data += chunk;
                return true;
            };
            res.end = chunk => {
                if (chunk) data += chunk;
                resolve({
                    statusCode: res.statusCode,
                    body: data
                });
            };

            if (body) {
                req.body = body;
            }

            app.handle(req, res);
        });
    }

    // 0. Sin clave de admin retorna 401
    const resNoAuth = await execReq({ url: '/api/import/tables', headers: { 'x-admin-key': '' } });
    assert.equal(resNoAuth.statusCode, 401);

    // 1. GET /api/import/tables retorna lista de tablas
    const resTables = await execReq({ url: '/api/import/tables' });
    assert.equal(resTables.statusCode, 200);
    const dataTables = JSON.parse(resTables.body);
    assert.ok(Array.isArray(dataTables.tables));

    // 2. POST /api/import/preview con JSON base64
    const csvContent = 'ID,NOMBRE\n10,JUAN\n20,ANA';
    const csvBase64 = Buffer.from(csvContent).toString('base64');
    const resPreview = await execReq({
        method: 'POST',
        url: '/api/import/preview',
        headers: {
            'content-type': 'application/json',
            'x-file-name': 'prueba.csv'
        },
        body: { fileBase64: csvBase64 }
    });
    assert.equal(resPreview.statusCode, 200);
    const previewData = JSON.parse(resPreview.body);
    assert.ok(previewData.uploadId);
    assert.equal(previewData.totalRows, 2);
    assert.deepEqual(previewData.columns, ['ID', 'NOMBRE']);

    // Limpiar archivo temporal creado
    await writeTempFile.removeFile(`${previewData.uploadId}.json`);

    // 3. POST /api/import/execute sin uploadId válido retorna 400
    const resExecFail = await execReq({
        method: 'POST',
        url: '/api/import/execute',
        headers: { 'content-type': 'application/json' },
        body: { uploadId: 'invalid-id', tableName: 'MI_TABLA' }
    });
    assert.equal(resExecFail.statusCode, 400);

    // 4. POST /api/import/direct sin nombre de tabla retorna 400
    const resDirectFail = await execReq({
        method: 'POST',
        url: '/api/import/direct',
        headers: { 'content-type': 'application/json' },
        body: { fileBase64: csvBase64 }
    });
    assert.equal(resDirectFail.statusCode, 400);
});
