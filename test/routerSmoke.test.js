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

    await t.test('POST /api/view/refresh reinicia la caché y responde 200', async () => {
        const res = await executeRequest({ method: 'POST', url: '/api/view/refresh' });
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.equal(data.status, 'ok');
        assert.ok(data.totalViews > 0);
    });

    await t.test('POST /api/view/save rechaza solicitud sin nombre', async () => {
        const res = await executeRequest({ method: 'POST', url: '/api/view/save', body: {} });
        assert.equal(res.statusCode, 400);
    });

    await t.test('POST /api/view/save registra vista y la deja disponible en memoria', async () => {
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

        const res = await executeRequest({ method: 'POST', url: '/api/view/save', body: newView });
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.equal(data.status, 'ok');
        assert.equal(data.viewName, 'testViewCreadaPorApi');

        // Verificar que ahora está disponible en el catálogo
        const listRes = await executeRequest({ url: '/api/view/list' });
        const listData = JSON.parse(listRes.body);
        assert.ok(listData.testViewCreadaPorApi, 'La nueva vista debe figurar en el catálogo');
    });

    await t.test('DELETE /api/view/testViewCreadaPorApi desactiva la vista', async () => {
        const res = await executeRequest({ method: 'DELETE', url: '/api/view/testViewCreadaPorApi' });
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.equal(data.status, 'ok');
    });
});

