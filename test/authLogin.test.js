const assert = require('node:assert/strict');
const test = require('node:test');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const database = require('../services/database');
const { login, createJwtHS256, verifyJwtHS256 } = require('../controllers/controlUsers');
const viewCatalog = require('../services/viewCatalog');

test('/api/auth/login consulta la vista users y autentica adecuadamente', async t => {
    const originalSimpleExecute = database.simpleExecute;

    t.afterEach(() => {
        database.simpleExecute = originalSimpleExecute;
    });

    await t.test('Rechaza con 400 si falta usr o pws', async () => {
        let statusCode = null;
        let responseBody = null;
        const res = {
            status: code => {
                statusCode = code;
                return {
                    json: body => { responseBody = body; }
                };
            }
        };

        await login({ body: { usr: '' } }, res);
        assert.equal(statusCode, 400);
        assert.ok(responseBody.error);

        await login({ body: { usr: 'admin', pws: '' } }, res);
        assert.equal(statusCode, 400);
    });

    await t.test('Consulta dinámicamente la vista users (SG_USUARIO) y devuelve 401 si no existe', async () => {
        let executedQuery = null;
        let executedBinds = null;

        database.simpleExecute = async (query, binds) => {
            executedQuery = query;
            executedBinds = binds;
            return { rows: [] };
        };

        let statusCode = null;
        let responseBody = null;
        const res = {
            status: code => {
                statusCode = code;
                return {
                    json: body => { responseBody = body; }
                };
            }
        };

        await login({ body: { usr: 'juan_perez', pws: '123456' } }, res);

        assert.equal(statusCode, 401);
        assert.equal(responseBody.error, 'Credenciales inválidas');

        // Verificar que la consulta SQL generada apunta a SG_USUARIO y usa binds
        assert.ok(executedQuery.includes('FROM SG_USUARIO'), 'Debe consultar la tabla configurada en vista users');
        assert.ok(executedQuery.includes('WHERE LOWER(USUARIO) = LOWER(:usr)'), 'Debe filtrar con bind :usr');
        assert.equal(executedBinds.usr, 'juan_perez');
    });

    await t.test('Rechaza con 403 si el usuario tiene estado inactivo (IDESTADOUS = 0 o 2 o I)', async () => {
        const hashedPassword = await bcrypt.hash('secret123', 10);

        database.simpleExecute = async () => {
            return {
                rows: [{
                    IDUS: 10,
                    DNI: 30123456,
                    USUARIO: 'usuario_inactivo',
                    CLAVE: hashedPassword,
                    MAIL: 'inactivo@ejemplo.com',
                    IDESTADOUS: 0, // Inactivo
                    ROL: 2,
                    APP: 'PORTAL'
                }]
            };
        };

        let statusCode = null;
        let responseBody = null;
        const res = {
            status: code => {
                statusCode = code;
                return {
                    json: body => { responseBody = body; }
                };
            }
        };

        await login({ body: { usr: 'usuario_inactivo', pws: 'secret123' } }, res);

        assert.equal(statusCode, 403);
        assert.ok(responseBody.error.includes('inactivo'));
    });

    await t.test('Autentica exitosamente con Bcrypt y retorna token con datos de vista users', async () => {
        const plainPassword = 'miClaveSegura2026';
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        database.simpleExecute = async () => {
            return {
                rows: [{
                    IDUS: 42,
                    DNI: 28999888,
                    USUARIO: 'operador_liq',
                    CLAVE: hashedPassword,
                    MAIL: 'operador@sueldos.gov.ar',
                    IDESTADOUS: 1, // Activo
                    ROL: 3,
                    APP: 'LIQUIDACION'
                }]
            };
        };

        let statusCode = null;
        let responseBody = null;
        const res = {
            status: code => {
                statusCode = code;
                return {
                    json: body => { responseBody = body; }
                };
            }
        };

        await login({ body: { usr: 'operador_liq', pws: plainPassword } }, res);

        assert.equal(statusCode, 200);
        assert.equal(responseBody.status, 'ok');
        assert.ok(responseBody.token, 'Debe devolver token JWT');

        // Verificar datos de usuario mapeados desde la vista users
        assert.equal(responseBody.user.id, 42);
        assert.equal(responseBody.user.usr, 'operador_liq');
        assert.equal(responseBody.user.userName, 'operador_liq');
        assert.equal(responseBody.user.dni, 28999888);
        assert.equal(responseBody.user.email, 'operador@sueldos.gov.ar');
        assert.equal(responseBody.user.role, 3);
        assert.equal(responseBody.user.app, 'LIQUIDACION');
        assert.equal(responseBody.user.estado, 1);

        // Verificar validez del JWT emitido
        const verifiedPayload = verifyJwtHS256(responseBody.token, process.env.JWT_SECRET || 'liqsys_secret_jwt_key_2026');
        assert.ok(verifiedPayload);
        assert.equal(verifiedPayload.sub, 'operador_liq');
        assert.equal(verifiedPayload.userId, 42);
        assert.equal(verifiedPayload.dni, 28999888);
        assert.equal(verifiedPayload.role, 3);
        assert.equal(verifiedPayload.app, 'LIQUIDACION');
    });

    await t.test('Tolera autenticación de migraciones previas con contraseña en texto plano', async () => {
        database.simpleExecute = async () => {
            return {
                rows: [{
                    IDUS: 1,
                    DNI: 12345678,
                    USUARIO: 'admin_legado',
                    CLAVE: 'plano123',
                    MAIL: 'admin@legado.com',
                    IDESTADOUS: 1,
                    ROL: 1,
                    APP: 'ADMIN'
                }]
            };
        };

        let statusCode = null;
        let responseBody = null;
        const res = {
            status: code => {
                statusCode = code;
                return {
                    json: body => { responseBody = body; }
                };
            }
        };

        await login({ body: { usr: 'admin_legado', pws: 'plano123' } }, res);

        assert.equal(statusCode, 200);
        assert.equal(responseBody.status, 'ok');
        assert.ok(responseBody.token);
    });

    await t.test('Tolera autenticación de migraciones previas con hash MD5', async () => {
        const md5Clave = crypto.createHash('md5').update('clave_md5_test').digest('hex');

        database.simpleExecute = async () => {
            return {
                rows: [{
                    IDUS: 2,
                    DNI: 23456789,
                    USUARIO: 'usuario_md5',
                    CLAVE: md5Clave,
                    MAIL: 'md5@legado.com',
                    IDESTADOUS: 1,
                    ROL: 2,
                    APP: 'CONSULTAS'
                }]
            };
        };

        let statusCode = null;
        let responseBody = null;
        const res = {
            status: code => {
                statusCode = code;
                return {
                    json: body => { responseBody = body; }
                };
            }
        };

        await login({ body: { usr: 'usuario_md5', pws: 'clave_md5_test' } }, res);

        assert.equal(statusCode, 200);
        assert.equal(responseBody.status, 'ok');
        assert.ok(responseBody.token);
    });

    await t.test('Rechaza con 401 si la contraseña no coincide', async () => {
        const hashedPassword = await bcrypt.hash('clave_correcta', 10);

        database.simpleExecute = async () => {
            return {
                rows: [{
                    IDUS: 3,
                    DNI: 34567890,
                    USUARIO: 'usuario_pass_erronea',
                    CLAVE: hashedPassword,
                    MAIL: 'err@legado.com',
                    IDESTADOUS: 1,
                    ROL: 2,
                    APP: 'CONSULTAS'
                }]
            };
        };

        let statusCode = null;
        let responseBody = null;
        const res = {
            status: code => {
                statusCode = code;
                return {
                    json: body => { responseBody = body; }
                };
            }
        };

        await login({ body: { usr: 'usuario_pass_erronea', pws: 'clave_incorrecta' } }, res);

        assert.equal(statusCode, 401);
        assert.equal(responseBody.error, 'Credenciales inválidas');
    });
});
