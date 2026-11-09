const assert = require('node:assert/strict');
const test = require('node:test');
const { 
    valuesMatch, 
    verifyJwtHS256, 
    createClientAuthMiddleware,
    createLoginAuthMiddleware
} = require('../services/clientAuth');
const { createJwtHS256 } = require('../controllers/controlUsers');

test('clientAuth service unit tests', async (t) => {
    const testSecret = 'super_secret_jwt_key_test';

    await t.test('valuesMatch valida claves de forma segura', () => {
        assert.equal(valuesMatch('secreto123', 'secreto123'), true);
        assert.equal(valuesMatch('secreto123', 'secreto456'), false);
        assert.equal(valuesMatch('secreto123', null), false);
        assert.equal(valuesMatch(null, 'secreto123'), false);
    });

    await t.test('verifyJwtHS256 valida correctamente tokens legítimos', () => {
        const payload = { sub: 'usuario_test', role: 2 };
        const token = createJwtHS256(payload, testSecret, 3600);
        
        const decoded = verifyJwtHS256(token, testSecret);
        assert.ok(decoded);
        assert.equal(decoded.sub, 'usuario_test');
        assert.equal(decoded.role, 2);
    });

    await t.test('verifyJwtHS256 rechaza tokens con firma falsa o secret incorrecto', () => {
        const payload = { sub: 'hacker' };
        const token = createJwtHS256(payload, testSecret, 3600);
        
        const decoded = verifyJwtHS256(token, 'otro_secreto_distinto');
        assert.equal(decoded, null);
    });

    await t.test('verifyJwtHS256 rechaza tokens expirados', () => {
        const payload = { sub: 'usuario_expirado' };
        // Token expirado hace 10 segundos
        const token = createJwtHS256(payload, testSecret, -10);
        
        const decoded = verifyJwtHS256(token, testSecret);
        assert.equal(decoded, null);
    });

    await t.test('clientAuthMiddleware permite acceso cuando REQUIRE_AUTH=false', () => {
        const middleware = createClientAuthMiddleware({ requireAuth: false });
        let nextCalled = false;
        const req = { get: () => null };
        const res = {};

        middleware(req, res, () => {
            nextCalled = true;
        });

        assert.equal(nextCalled, true);
    });

    await t.test('clientAuthMiddleware rechaza con 401 si REQUIRE_AUTH=true y no hay credenciales', () => {
        const middleware = createClientAuthMiddleware({ 
            requireAuth: true,
            adminKey: 'admin123',
            clientKey: 'client123'
        });
        
        let statusCode = null;
        let responseJson = null;

        const req = { get: () => null };
        const res = {
            status: (code) => {
                statusCode = code;
                return {
                    json: (data) => { responseJson = data; }
                };
            }
        };

        middleware(req, res, () => {});

        assert.equal(statusCode, 401);
        assert.equal(responseJson.code, 'UNAUTHORIZED');
    });

    await t.test('clientAuthMiddleware permite acceso con X-API-Key válida', () => {
        const middleware = createClientAuthMiddleware({ 
            requireAuth: true,
            clientKey: 'mi_clave_de_cliente'
        });

        let nextCalled = false;
        const req = { 
            get: (header) => header.toLowerCase() === 'x-api-key' ? 'mi_clave_de_cliente' : null 
        };
        const res = {};

        middleware(req, res, () => {
            nextCalled = true;
        });

        assert.equal(nextCalled, true);
        assert.equal(req.isClient, true);
    });

    await t.test('clientAuthMiddleware permite acceso con X-Admin-Key válida', () => {
        const middleware = createClientAuthMiddleware({ 
            requireAuth: true,
            adminKey: 'mi_clave_de_admin'
        });

        let nextCalled = false;
        const req = { 
            get: (header) => header.toLowerCase() === 'x-admin-key' ? 'mi_clave_de_admin' : null 
        };
        const res = {};

        middleware(req, res, () => {
            nextCalled = true;
        });

        assert.equal(nextCalled, true);
        assert.equal(req.isAdmin, true);
    });

    await t.test('clientAuthMiddleware permite acceso con Bearer JWT válido', () => {
        const validToken = createJwtHS256({ sub: 'empleado1' }, testSecret, 3600);

        const middleware = createClientAuthMiddleware({ 
            requireAuth: true,
            jwtSecret: testSecret
        });

        let nextCalled = false;
        const req = { 
            get: (header) => header.toLowerCase() === 'authorization' ? `Bearer ${validToken}` : null 
        };
        const res = {};

        middleware(req, res, () => {
            nextCalled = true;
        });

        assert.equal(nextCalled, true);
        assert.ok(req.user);
        assert.equal(req.user.sub, 'empleado1');
    });

    await t.test('loginAuthMiddleware permite login libre cuando REQUIRE_AUTH=false', () => {
        const middleware = createLoginAuthMiddleware({ requireAuth: false });
        let nextCalled = false;
        const req = { get: () => null, body: { usr: 'admin', pws: '123' } };
        middleware(req, {}, () => { nextCalled = true; });
        assert.equal(nextCalled, true);
    });

    await t.test('loginAuthMiddleware rechaza login con 401 si REQUIRE_AUTH=true y no hay X-API-Key', () => {
        const middleware = createLoginAuthMiddleware({
            requireAuth: true,
            clientKey: 'clave_front_123',
            adminKey: 'clave_admin_123'
        });

        let statusCode = null;
        let responseJson = null;
        const req = { get: () => null, body: { usr: 'admin', pws: '123' } };
        const res = {
            status: code => {
                statusCode = code;
                return { json: data => { responseJson = data; } };
            }
        };

        middleware(req, res, () => {});
        assert.equal(statusCode, 401);
        assert.equal(responseJson.code, 'UNAUTHORIZED_CLIENT');
    });

    await t.test('loginAuthMiddleware permite login si viene con X-API-Key válida', () => {
        const middleware = createLoginAuthMiddleware({
            requireAuth: true,
            clientKey: 'clave_front_123'
        });

        let nextCalled = false;
        const req = {
            get: h => h.toLowerCase() === 'x-api-key' ? 'clave_front_123' : null,
            body: { usr: 'admin', pws: '123' }
        };

        middleware(req, {}, () => { nextCalled = true; });
        assert.equal(nextCalled, true);
        assert.equal(req.isClient, true);
    });

    await t.test('loginAuthMiddleware permite login si viene con apiKey en body', () => {
        const middleware = createLoginAuthMiddleware({
            requireAuth: true,
            clientKey: 'clave_front_123'
        });

        let nextCalled = false;
        const req = {
            get: () => null,
            body: { usr: 'admin', pws: '123', apiKey: 'clave_front_123' }
        };

        middleware(req, {}, () => { nextCalled = true; });
        assert.equal(nextCalled, true);
        assert.equal(req.isClient, true);
    });

    await t.test('loginAuthMiddleware permite login si viene con X-Admin-Key válida', () => {
        const middleware = createLoginAuthMiddleware({
            requireAuth: true,
            adminKey: 'clave_admin_123',
            clientKey: 'clave_front_123'
        });

        let nextCalled = false;
        const req = {
            get: h => h.toLowerCase() === 'x-admin-key' ? 'clave_admin_123' : null,
            body: { usr: 'admin', pws: '123' }
        };

        middleware(req, {}, () => { nextCalled = true; });
        assert.equal(nextCalled, true);
        assert.equal(req.isAdmin, true);
    });
});
