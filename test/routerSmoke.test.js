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

    await t.test('POST /api/adduser sin datos obligatorios responde 400', async () => {
        const res = await executeRequest({ method: 'POST', url: '/api/adduser', body: {} });
        assert.equal(res.statusCode, 400);
        const data = JSON.parse(res.body);
        assert.equal(data.error, 'usr, pws y email son requeridos');
    });
});
