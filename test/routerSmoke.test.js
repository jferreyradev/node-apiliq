const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const http = require('node:http');
const router = require('../services/router');

const app = express();
app.use('/api', router);

function executeRequest({ method = 'GET', url, headers = {}, body = null }) {
    return new Promise(resolve => {
        const req = new http.IncomingMessage();
        req.method = method;
        req.url = url;
        req.headers = { host: 'localhost', ...headers };
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

test('Router responde catálogos de mappers y rutas de error sin base de datos', async t => {
    await t.test('GET /api/en/list retorna entidades mapeadas', async () => {
        const res = await executeRequest({ url: '/api/en/list' });
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.ok(data.hoja);
        assert.ok(data.reparticion);
    });

    await t.test('GET /api/view/list retorna vistas mapeadas', async () => {
        const res = await executeRequest({ url: '/api/view/list' });
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.ok(data.configServer);
    });

    await t.test('GET /api/sp/list retorna procedures mapeados', async () => {
        const res = await executeRequest({ url: '/api/sp/list' });
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.ok(data.liq);
    });

    await t.test('GET /api/fn/list retorna funciones mapeadas', async () => {
        const res = await executeRequest({ url: '/api/fn/list' });
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.ok(data.verifConcepto);
    });

    await t.test('GET /api/repo/list retorna reportes mapeados', async () => {
        const res = await executeRequest({ url: '/api/repo/list' });
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.ok(data.resumenLiq);
    });

    await t.test('GET /api/view/noExiste responde 404', async () => {
        const res = await executeRequest({ url: '/api/view/noExiste' });
        assert.equal(res.statusCode, 404);
    });

    await t.test('GET /api/generaNovIPSST sin uploadId responde 400', async () => {
        const res = await executeRequest({ url: '/api/generaNovIPSST' });
        assert.equal(res.statusCode, 400);
    });

    await t.test('GET /api/view/configServer con campo no permitido en fields responde 400', async () => {
        const res = await executeRequest({ url: '/api/view/configServer?fields=CampoInexistente' });
        assert.equal(res.statusCode, 400);
        const data = JSON.parse(res.body);
        assert.match(data.error, /Campo no permitido en selección/);
    });

    const adminHeaders = { 'x-admin-key': process.env.ADMIN_ACCESS_KEY || 'admin_liq_2026' };

    await t.test('POST /api/admin/verify valida clave de administración', async () => {
        const resBad = await executeRequest({
            method: 'POST',
            url: '/api/admin/verify',
            headers: { 'x-admin-key': 'clave_invalida' }
        });
        assert.equal(resBad.statusCode, 401);

        const resOk = await executeRequest({
            method: 'POST',
            url: '/api/admin/verify',
            headers: adminHeaders
        });
        assert.equal(resOk.statusCode, 200);
        const data = JSON.parse(resOk.body);
        assert.equal(data.authenticated, true);
    });

    await t.test('POST /api/view/refresh rechaza solicitud sin clave de admin (401)', async () => {
        const res = await executeRequest({ method: 'POST', url: '/api/view/refresh' });
        assert.equal(res.statusCode, 401);
    });

    await t.test('POST /api/view/refresh reinicia la caché con clave y responde 200', async () => {
        const res = await executeRequest({
            method: 'POST',
            url: '/api/view/refresh',
            headers: adminHeaders
        });
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.equal(data.status, 'ok');
        assert.ok(data.totalViews > 0);
    });

    await t.test('POST /api/view/seed-from-file rechaza solicitud sin clave de admin (401)', async () => {
        const res = await executeRequest({ method: 'POST', url: '/api/view/seed-from-file' });
        assert.equal(res.statusCode, 401);
    });

    await t.test('POST /api/view/seed-from-file sincroniza vistas con clave y responde 200', async () => {
        const res = await executeRequest({
            method: 'POST',
            url: '/api/view/seed-from-file',
            headers: adminHeaders
        });
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.equal(data.status, 'ok');
        assert.ok(data.total > 0);
        assert.equal(data.successful, data.total);
    });

    await t.test('POST /api/view/import-json rechaza solicitud sin clave de admin (401)', async () => {
        const res = await executeRequest({ method: 'POST', url: '/api/view/import-json' });
        assert.equal(res.statusCode, 401);
    });

    await t.test('POST /api/view/import-json rechaza payload no válido (400)', async () => {
        const res = await executeRequest({
            method: 'POST',
            url: '/api/view/import-json',
            headers: adminHeaders,
            body: 'invalido'
        });
        assert.equal(res.statusCode, 400);
    });

    await t.test('POST /api/view/import-json importa objeto de vistas con clave y responde 200', async () => {
        const payload = {
            vistaImportadaTest: {
                fields: { Id: '1' },
                sql: { fromClause: ['FROM DUAL'] }
            }
        };
        const res = await executeRequest({
            method: 'POST',
            url: '/api/view/import-json',
            headers: adminHeaders,
            body: payload
        });
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.equal(data.status, 'ok');
        assert.equal(data.successful, 1);
    });

    await t.test('POST /api/view/save rechaza solicitud sin nombre con clave', async () => {
        const res = await executeRequest({
            method: 'POST',
            url: '/api/view/save',
            headers: adminHeaders,
            body: {}
        });
        assert.equal(res.statusCode, 400);
    });

    await t.test('POST /api/view/save registra vista con clave y la deja disponible en memoria', async () => {
        const newView = {
            viewName: 'testViewCreadaPorApi',
            description: 'Vista de prueba creada dinámicamente',
            fields: {
                Id: 'p.idpers',
                Dni: 'p.dni'
            },
            fromClause: ['FROM personas p'],
            whereFields: { Dni: 'p.dni' }
        };

        const res = await executeRequest({
            method: 'POST',
            url: '/api/view/save',
            headers: adminHeaders,
            body: newView
        });
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.equal(data.status, 'ok');
        assert.equal(data.viewName, 'testViewCreadaPorApi');

        // Verificar que ahora está disponible en el catálogo
        const listRes = await executeRequest({ url: '/api/view/list' });
        const listData = JSON.parse(listRes.body);
        assert.ok(listData.testViewCreadaPorApi, 'La nueva vista debe figurar en el catálogo');
    });

    await t.test('DELETE /api/view/testViewCreadaPorApi desactiva la vista con clave', async () => {
        const res = await executeRequest({
            method: 'DELETE',
            url: '/api/view/testViewCreadaPorApi',
            headers: adminHeaders
        });
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.equal(data.status, 'ok');
    });
});

