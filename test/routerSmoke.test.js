const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const http = require('node:http');
const router = require('../services/router');
const controlUser = require('../controllers/controlUsers');

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

    await t.test('POST /api/adduser rechaza solicitud sin clave de admin (401)', async () => {
        const res = await executeRequest({
            method: 'POST',
            url: '/api/adduser',
            body: { usr: 'test', pws: '123', email: 'test@example.com' }
        });
        assert.equal(res.statusCode, 401);
    });

    await t.test('POST /api/adduser con clave de admin pero sin campos requeridos responde 400', async () => {
        const res = await executeRequest({
            method: 'POST',
            url: '/api/adduser',
            headers: adminHeaders,
            body: {}
        });
        assert.equal(res.statusCode, 400);
    });

    await t.test('createJwtHS256 genera token JWT RFC 7519 válido', () => {
        const token = controlUser.createJwtHS256({ sub: 'admin', role: 1 }, 'test-secret', 3600);
        assert.ok(token);
        const parts = token.split('.');
        assert.equal(parts.length, 3);
        const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
        assert.equal(header.alg, 'HS256');
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        assert.equal(payload.sub, 'admin');
        assert.equal(payload.role, 1);
        assert.ok(payload.exp > payload.iat);
    });

    await t.test('POST /api/sql/execute rechaza solicitud sin clave de admin (401)', async () => {
        const res = await executeRequest({
            method: 'POST',
            url: '/api/sql/execute',
            body: { sql: 'SELECT 1 FROM DUAL' }
        });
        assert.equal(res.statusCode, 401);
    });

    await t.test('POST /api/sql/execute rechaza consulta no SELECT o con punto y coma (400)', async () => {
        const res1 = await executeRequest({
            method: 'POST',
            url: '/api/sql/execute',
            headers: adminHeaders,
            body: { sql: 'DROP TABLE EMPLEADOS' }
        });
        assert.equal(res1.statusCode, 400);

        const res2 = await executeRequest({
            method: 'POST',
            url: '/api/sql/execute',
            headers: adminHeaders,
            body: { sql: 'SELECT 1 FROM DUAL;' }
        });
        assert.equal(res2.statusCode, 400);
    });

    await t.test('GET /api/status responde 200 con telemetria publica', async () => {
        const res = await executeRequest({ url: '/api/status' });
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.equal(data.status, 'ok');
        assert.equal(data.service, 'node-apiliq');
        assert.ok(data.uptime);
        assert.ok(data.database);
    });

    await t.test('GET /api/health responde 200 con telemetria publica', async () => {
        const res = await executeRequest({ url: '/api/health' });
        assert.equal(res.statusCode, 200);
        const data = JSON.parse(res.body);
        assert.equal(data.status, 'ok');
    });

    await t.test('clientAuth en router: protege endpoints de datos cuando REQUIRE_AUTH=true', async () => {
        const origRequire = process.env.REQUIRE_AUTH;
        const origClient = process.env.API_CLIENT_KEY;
        const origAdmin = process.env.ADMIN_ACCESS_KEY;
        const origSecret = process.env.JWT_SECRET;

        try {
            process.env.REQUIRE_AUTH = 'true';
            process.env.API_CLIENT_KEY = 'clave_cliente_test';
            process.env.ADMIN_ACCESS_KEY = 'clave_admin_test';
            process.env.JWT_SECRET = 'secret_test';

            // 1. Sin credenciales -> 401
            const resAnon = await executeRequest({ url: '/api/view/list' });
            assert.equal(resAnon.statusCode, 401);

            // 2. Con X-API-Key -> 200
            const resClient = await executeRequest({ 
                url: '/api/view/list',
                headers: { 'x-api-key': 'clave_cliente_test' }
            });
            assert.equal(resClient.statusCode, 200);

            // 3. Con X-Admin-Key -> 200
            const resAdmin = await executeRequest({ 
                url: '/api/view/list',
                headers: { 'x-admin-key': 'clave_admin_test' }
            });
            assert.equal(resAdmin.statusCode, 200);

            // 4. Con Bearer JWT -> 200
            const validToken = controlUser.createJwtHS256({ sub: 'user1' }, 'secret_test', 3600);
            const resJwt = await executeRequest({ 
                url: '/api/view/list',
                headers: { 'authorization': `Bearer ${validToken}` }
            });
            assert.equal(resJwt.statusCode, 200);

            // 5. Telemetria publica /status sigue respondiendo 200 sin clave
            const resStatus = await executeRequest({ url: '/api/status' });
            assert.equal(resStatus.statusCode, 200);
        } finally {
            if (origRequire !== undefined) process.env.REQUIRE_AUTH = origRequire;
            else delete process.env.REQUIRE_AUTH;

            if (origClient !== undefined) process.env.API_CLIENT_KEY = origClient;
            else delete process.env.API_CLIENT_KEY;

            if (origAdmin !== undefined) process.env.ADMIN_ACCESS_KEY = origAdmin;
            else delete process.env.ADMIN_ACCESS_KEY;

            if (origSecret !== undefined) process.env.JWT_SECRET = origSecret;
            else delete process.env.JWT_SECRET;
        }
    });
});

