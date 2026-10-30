const crypto = require('crypto');

if (!process.env.ADMIN_ACCESS_KEY) {
    try {
        require('dotenv').config();
    } catch (_) {
        // En caso de entorno sin dotenv
    }
}

function valuesMatch(expected, provided) {
    if (!expected || !provided) {
        return false;
    }

    const expectedBuffer = Buffer.from(String(expected));
    const providedBuffer = Buffer.from(String(provided));

    if (expectedBuffer.length !== providedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function extractKeyFromRequest(req) {
    // 1. Header específico X-Admin-Key
    const customHeader = req.get('X-Admin-Key');
    if (customHeader) return customHeader.trim();

    // 2. Header Authorization: Bearer <key>
    const authHeader = req.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7).trim();
    }

    // 3. Body key si viene en JSON
    if (req.body && req.body.adminKey) {
        return String(req.body.adminKey).trim();
    }

    // 4. Query param ?admin_key=...
    if (req.query && req.query.admin_key) {
        return String(req.query.admin_key).trim();
    }

    return null;
}

/**
 * Middleware para proteger rutas de administración y endpoints de modificación.
 */
function adminAuthMiddleware(req, res, next) {
    const expectedKey = process.env.ADMIN_ACCESS_KEY;

    if (!expectedKey) {
        if (process.env.ALLOW_ANONYMOUS_ADMIN === 'true') {
            req.isAdmin = true;
            return next();
        }
        return res.status(503).json({
            error: 'La clave de acceso de administrador (ADMIN_ACCESS_KEY) no está configurada en .env'
        });
    }

    const providedKey = extractKeyFromRequest(req);

    if (!providedKey) {
        return res.status(401).json({
            error: 'Acceso no autorizado. Se requiere la cabecera X-Admin-Key o Authorization: Bearer <clave>'
        });
    }

    if (!valuesMatch(expectedKey, providedKey)) {
        return res.status(403).json({
            error: 'Clave de acceso de administrador incorrecta'
        });
    }

    req.isAdmin = true;
    next();
}

/**
 * Endpoint para verificar si una clave es válida (usado por la pantalla de login del frontend).
 */
function verifyKeyHandler(req, res) {
    const expectedKey = process.env.ADMIN_ACCESS_KEY;

    if (!expectedKey) {
        return res.status(503).json({
            status: 'error',
            error: 'ADMIN_ACCESS_KEY no está configurada en el servidor'
        });
    }

    const providedKey = extractKeyFromRequest(req);

    if (!providedKey || !valuesMatch(expectedKey, providedKey)) {
        return res.status(401).json({
            status: 'error',
            authenticated: false,
            error: 'Clave de acceso incorrecta'
        });
    }

    res.status(200).json({
        status: 'ok',
        authenticated: true,
        message: 'Autenticación de administrador exitosa'
    });
}

/**
 * Endpoint de estado y diagnóstico para el Admin Studio (/api/admin/health).
 */
async function adminHealthHandler(req, res) {
    const rawConnectionString = process.env.CONNECTIONSTRING || '';
    const cleanConnString = rawConnectionString.replace(/^https?:\/\//i, '').trim();
    const user = process.env.USERDB || 'US_SUELDO';

    const health = {
        status: 'ok',
        api: 'online',
        uptimeSeconds: Math.round(process.uptime()),
        database: {
            user: user,
            connectionString: cleanConnString,
            connected: false,
            message: 'Inactivo / pendiente de prueba'
        }
    };

    const database = require('./database');
    health.database.pool = database.getPoolStats();

    if (req.query.testDb === 'true') {
        const oracledb = require('oracledb');
        let conn;
        try {
            const pool = oracledb.getPool();
            if (pool) {
                conn = await pool.getConnection();
                await conn.execute('SELECT 1 FROM DUAL');
                health.database.connected = true;
                health.database.message = 'Conexión a Oracle OK';
            } else {
                health.database.message = 'Pool de Oracle no inicializado';
            }
        } catch (err) {
            health.database.connected = false;
            health.database.message = err.message;
            health.database.code = err.code || err.errorNum;
        } finally {
            if (conn) {
                try { await conn.close(); } catch (_) {}
            }
        }
    }

    res.status(200).json(health);
}

/**
 * Endpoint de telemetría y diagnóstico en vivo del pool de conexiones Oracle (/api/admin/pool-status).
 */
function adminPoolStatusHandler(req, res) {
    const database = require('./database');
    const stats = database.getPoolStats();
    res.status(200).json({
        service: 'node-apiliq',
        pool: stats,
        timestamp: new Date().toISOString()
    });
}

module.exports = {
    adminAuthMiddleware,
    verifyKeyHandler,
    adminHealthHandler,
    adminPoolStatusHandler,
    extractKeyFromRequest,
    valuesMatch
};

