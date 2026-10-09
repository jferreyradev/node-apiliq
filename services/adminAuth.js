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

module.exports = {
    adminAuthMiddleware,
    verifyKeyHandler,
    extractKeyFromRequest,
    valuesMatch
};
