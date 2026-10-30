const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const zlib = require('node:zlib');
const express = require('express');

const requestIdMiddleware = require('../services/requestId');
const compressionMiddleware = require('../services/compression');
const database = require('../services/database');
const router = require('../services/router');

function executeMockRequest(appInstance, { method = 'GET', url = '/', headers = {}, body = null }) {
    return new Promise(resolve => {
        const req = new http.IncomingMessage();
        req.method = method;
        req.url = url;
        req.headers = { host: 'localhost', ...headers };
        req.connection = { remoteAddress: '127.0.0.1' };
        req.socket = req.connection;

        const res = new http.ServerResponse(req);
        const chunks = [];

        res.write = chunk => {
            if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            return true;
        };

        res.end = chunk => {
            if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            const buffer = Buffer.concat(chunks);
            resolve({
                statusCode: res.statusCode,
                headers: res.getHeaders(),
                buffer,
                body: buffer.toString('utf8'),
                res
            });
        };

        if (body) {
            req.body = body;
        }

        appInstance.handle(req, res);
    });
}

describe('Trazabilidad y Request ID (X-Request-ID)', () => {
    test('genera un UUID válido en X-Request-Id y req.id si no viene en la petición', async () => {
        const app = express();
        app.use(requestIdMiddleware);
        let capturedId = null;
        app.get('/test-id', (req, res) => {
            capturedId = req.id;
            res.json({ id: req.id });
        });

        const response = await executeMockRequest(app, { url: '/test-id' });
        assert.equal(response.statusCode, 200);

        const headerId = response.headers['x-request-id'];
        assert.ok(headerId, 'Debe incluir header x-request-id');
        assert.match(headerId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        assert.equal(capturedId, headerId);
    });

    test('preserva el X-Request-Id provisto por el cliente', async () => {
        const app = express();
        app.use(requestIdMiddleware);
        let capturedId = null;
        app.get('/test-id-custom', (req, res) => {
            capturedId = req.id;
            res.json({ id: req.id });
        });

        const customId = 'client-trace-123456';
        const response = await executeMockRequest(app, {
            url: '/test-id-custom',
            headers: { 'x-request-id': customId }
        });

        assert.equal(response.statusCode, 200);
        assert.equal(response.headers['x-request-id'], customId);
        assert.equal(capturedId, customId);
    });
});

describe('Compresión HTTP Transparente', () => {
    test('no comprime payloads menores al umbral de 1 KB', async () => {
        const app = express();
        app.use(compressionMiddleware({ threshold: 1024 }));
        app.get('/small', (req, res) => {
            res.json({ msg: 'pequeño' });
        });

        const response = await executeMockRequest(app, {
            url: '/small',
            headers: { 'accept-encoding': 'gzip' }
        });

        assert.equal(response.statusCode, 200);
        assert.equal(response.headers['content-encoding'], undefined);
        const data = JSON.parse(response.body);
        assert.equal(data.msg, 'pequeño');
    });

    test('comprime con gzip payloads mayores a 1 KB cuando el cliente lo solicita', async () => {
        const app = express();
        app.use(compressionMiddleware({ threshold: 1024 }));

        const largeData = Array.from({ length: 50 }, (_, i) => ({
            id: i,
            nombre: `Empleado Número ${i} de la Municipalidad`,
            cargo: 'ADMINISTRATIVO CATEGORIA 18',
            sueldo: 450000 + i * 1000
        }));

        app.get('/large', (req, res) => {
            res.json(largeData);
        });

        const response = await executeMockRequest(app, {
            url: '/large',
            headers: { 'accept-encoding': 'gzip, deflate' }
        });

        assert.equal(response.statusCode, 200);
        assert.equal(response.headers['content-encoding'], 'gzip');
        assert.ok(response.headers['vary']?.includes('Accept-Encoding'));

        // Descomprimir manualmente con zlib para verificar contenido
        const uncompressed = zlib.gunzipSync(response.buffer).toString('utf8');
        const parsed = JSON.parse(uncompressed);
        assert.equal(parsed.length, 50);
        assert.equal(parsed[0].nombre, 'Empleado Número 0 de la Municipalidad');
    });

    test('no comprime si el cliente no envía Accept-Encoding compatible', async () => {
        const app = express();
        app.use(compressionMiddleware({ threshold: 1024 }));

        const largeData = Array.from({ length: 50 }, (_, i) => ({ id: i, text: 'datos masivos' }));
        app.get('/large-raw', (req, res) => {
            res.json(largeData);
        });

        const response = await executeMockRequest(app, {
            url: '/large-raw',
            headers: { 'accept-encoding': 'identity' }
        });

        assert.equal(response.statusCode, 200);
        assert.equal(response.headers['content-encoding'], undefined);
        const parsed = JSON.parse(response.body);
        assert.equal(parsed.length, 50);
    });
});

describe('Telemetría y Estado del Pool de Oracle', () => {
    test('database.getPoolStats retorna estructura consistente incluso sin BD conectada', () => {
        const stats = database.getPoolStats();
        assert.ok(stats);
        assert.ok('status' in stats);
        assert.ok('open' in stats);
    });

    test('GET /api/admin/pool-status requiere clave de administrador', async () => {
        const app = express();
        app.use('/api', router);

        const response = await executeMockRequest(app, { url: '/api/admin/pool-status' });
        assert.equal(response.statusCode, 401);
        const body = JSON.parse(response.body);
        assert.ok(body.error);
    });

    test('GET /api/admin/pool-status responde datos del pool con clave válida', async () => {
        const app = express();
        app.use('/api', router);
        const adminKey = process.env.ADMIN_ACCESS_KEY || 'admin_liq_2026';

        const response = await executeMockRequest(app, {
            url: '/api/admin/pool-status',
            headers: { 'x-admin-key': adminKey }
        });

        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.service, 'node-apiliq');
        assert.ok(body.pool);
        assert.ok('status' in body.pool);
        assert.ok('open' in body.pool);
        assert.ok(body.timestamp);
    });

    test('GET /api/admin/health incluye métricas del pool en su reporte', async () => {
        const app = express();
        app.use('/api', router);

        const response = await executeMockRequest(app, { url: '/api/admin/health' });
        assert.equal(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.status, 'ok');
        assert.ok(body.database);
        assert.ok(body.database.pool, 'database.pool debe estar presente');
        assert.ok('open' in body.database.pool);
    });
});
