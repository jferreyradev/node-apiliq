const assert = require('node:assert/strict');
const test = require('node:test');
const { valuesMatch, extractKeyFromRequest, adminAuthMiddleware, verifyKeyHandler } = require('../services/adminAuth');

test('adminAuth service unit tests', async t => {
    await t.test('valuesMatch compara claves con timing-safe', () => {
        assert.equal(valuesMatch('secreto123', 'secreto123'), true);
        assert.equal(valuesMatch('secreto123', 'secreto456'), false);
        assert.equal(valuesMatch('secreto123', 'secreto'), false);
        assert.equal(valuesMatch('secreto', 'secreto123'), false);
        assert.equal(valuesMatch(null, 'secreto'), false);
        assert.equal(valuesMatch('secreto', undefined), false);
        assert.equal(valuesMatch('', ''), false);
    });

    await t.test('extractKeyFromRequest extrae la clave desde distintas fuentes', () => {
        // X-Admin-Key
        const reqCustomHeader = {
            get: header => header.toLowerCase() === 'x-admin-key' ? 'mi_clave_custom' : null
        };
        assert.equal(extractKeyFromRequest(reqCustomHeader), 'mi_clave_custom');

        // Authorization: Bearer
        const reqBearer = {
            get: header => header.toLowerCase() === 'authorization' ? 'Bearer mi_token_bearer' : null
        };
        assert.equal(extractKeyFromRequest(reqBearer), 'mi_token_bearer');

        // req.body.adminKey
        const reqBody = {
            get: () => null,
            body: { adminKey: 'mi_clave_body' }
        };
        assert.equal(extractKeyFromRequest(reqBody), 'mi_clave_body');

        // req.query.admin_key
        const reqQuery = {
            get: () => null,
            query: { admin_key: 'mi_clave_query' }
        };
        assert.equal(extractKeyFromRequest(reqQuery), 'mi_clave_query');

        // Sin clave
        const reqEmpty = {
            get: () => null
        };
        assert.equal(extractKeyFromRequest(reqEmpty), null);
    });

    await t.test('adminAuthMiddleware valida el acceso de administrador', () => {
        const originalEnv = process.env.ADMIN_ACCESS_KEY;
        const originalAnon = process.env.ALLOW_ANONYMOUS_ADMIN;

        try {
            process.env.ADMIN_ACCESS_KEY = 'clave_super_secreta';
            delete process.env.ALLOW_ANONYMOUS_ADMIN;

            // 1. Falta clave en la solicitud -> 401
            let statusCalled = null;
            let jsonCalled = null;
            const res401 = {
                status: code => {
                    statusCalled = code;
                    return {
                        json: data => { jsonCalled = data; }
                    };
                }
            };
            const reqSinClave = { get: () => null };
            adminAuthMiddleware(reqSinClave, res401, () => {});
            assert.equal(statusCalled, 401);
            assert.ok(jsonCalled.error);

            // 2. Clave incorrecta -> 403
            const reqClaveErronea = {
                get: header => header.toLowerCase() === 'x-admin-key' ? 'clave_incorrecta' : null
            };
            adminAuthMiddleware(reqClaveErronea, res401, () => {});
            assert.equal(statusCalled, 403);

            // 3. Clave correcta -> llama a next()
            let nextCalled = false;
            const reqClaveOk = {
                get: header => header.toLowerCase() === 'x-admin-key' ? 'clave_super_secreta' : null
            };
            adminAuthMiddleware(reqClaveOk, res401, () => {
                nextCalled = true;
            });
            assert.equal(nextCalled, true);
            assert.equal(reqClaveOk.isAdmin, true);

            // 4. ADMIN_ACCESS_KEY no configurada en env -> 503
            delete process.env.ADMIN_ACCESS_KEY;
            adminAuthMiddleware(reqSinClave, res401, () => {});
            assert.equal(statusCalled, 503);

            // 5. ALLOW_ANONYMOUS_ADMIN=true -> permite sin clave
            process.env.ALLOW_ANONYMOUS_ADMIN = 'true';
            let nextAnonCalled = false;
            adminAuthMiddleware(reqSinClave, res401, () => {
                nextAnonCalled = true;
            });
            assert.equal(nextAnonCalled, true);
        } finally {
            if (originalEnv !== undefined) {
                process.env.ADMIN_ACCESS_KEY = originalEnv;
            } else {
                delete process.env.ADMIN_ACCESS_KEY;
            }
            if (originalAnon !== undefined) {
                process.env.ALLOW_ANONYMOUS_ADMIN = originalAnon;
            } else {
                delete process.env.ALLOW_ANONYMOUS_ADMIN;
            }
        }
    });

    await t.test('verifyKeyHandler responde adecuadamente', () => {
        const originalEnv = process.env.ADMIN_ACCESS_KEY;

        try {
            process.env.ADMIN_ACCESS_KEY = 'clave_login_ok';

            let statusCalled = null;
            let jsonCalled = null;
            const mockRes = {
                status: code => {
                    statusCalled = code;
                    return {
                        json: data => { jsonCalled = data; }
                    };
                }
            };

            // Clave incorrecta -> 401
            const reqWrong = {
                get: header => header.toLowerCase() === 'x-admin-key' ? 'incorrecta' : null
            };
            verifyKeyHandler(reqWrong, mockRes);
            assert.equal(statusCalled, 401);
            assert.equal(jsonCalled.authenticated, false);

            // Clave correcta -> 200
            const reqOk = {
                get: header => header.toLowerCase() === 'x-admin-key' ? 'clave_login_ok' : null
            };
            verifyKeyHandler(reqOk, mockRes);
            assert.equal(statusCalled, 200);
            assert.equal(jsonCalled.authenticated, true);
        } finally {
            if (originalEnv !== undefined) {
                process.env.ADMIN_ACCESS_KEY = originalEnv;
            } else {
                delete process.env.ADMIN_ACCESS_KEY;
            }
        }
    });
});
