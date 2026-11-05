const crypto = require('crypto');

/**
 * Compara dos cadenas de forma segura frente a ataques de temporización (timing attacks).
 */
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

/**
 * Decodifica y verifica un token JWT estándar HS256 (RFC 7519) usando el módulo nativo crypto.
 * Retorna el payload decodificado si es válido, o null si está vencido o la firma es inválida.
 */
function verifyJwtHS256(token, secret) {
    if (!token || typeof token !== 'string') return null;

    const parts = token.trim().split('.');
    if (parts.length !== 3) return null;

    const [encHeader, encPayload, encSignature] = parts;

    // Verificar firma HMAC-SHA256
    try {
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(`${encHeader}.${encPayload}`)
            .digest('base64url');

        const expectedSigBuf = Buffer.from(expectedSignature);
        const providedSigBuf = Buffer.from(encSignature);

        if (expectedSigBuf.length !== providedSigBuf.length) {
            return null;
        }

        if (!crypto.timingSafeEqual(expectedSigBuf, providedSigBuf)) {
            return null;
        }

        // Parsear Header y Payload
        const header = JSON.parse(Buffer.from(encHeader, 'base64url').toString('utf8'));
        if (header.alg !== 'HS256') {
            return null;
        }

        const payload = JSON.parse(Buffer.from(encPayload, 'base64url').toString('utf8'));

        // Verificar expiración si tiene campo exp
        if (typeof payload.exp === 'number') {
            const now = Math.floor(Date.now() / 1000);
            if (now > payload.exp) {
                return null; // Token expirado
            }
        }

        return payload;
    } catch (_) {
        return null;
    }
}

/**
 * Middleware híbrido de autenticación para clientes frontend y usuarios:
 * Permite acceso si se cumple CUALQUIERA de estas condiciones:
 *  1. REQUIRE_AUTH !== 'true' (Retrocompatibilidad / desarrollo local).
 *  2. Es Administrador (req.isAdmin === true o X-Admin-Key coincide con ADMIN_ACCESS_KEY).
 *  3. Posee X-API-Key que coincide con API_CLIENT_KEY.
 *  4. Posee un token Bearer JWT válido firmado con JWT_SECRET.
 */
function createClientAuthMiddleware(options = {}) {
    return (req, res, next) => {
        const requireAuth = options.requireAuth ?? (process.env.REQUIRE_AUTH === 'true');

        // Modo abierto (desarrollo local o intranet abierta)
        if (!requireAuth) {
            return next();
        }

        const adminKey = options.adminKey ?? process.env.ADMIN_ACCESS_KEY;
        const clientKey = options.clientKey ?? process.env.API_CLIENT_KEY;
        const jwtSecret = options.jwtSecret ?? (process.env.JWT_SECRET || 'liqsys_secret_jwt_key_2026');

        // 1. Si ya fue verificado como admin previamente
        if (req.isAdmin) {
            return next();
        }

        // 2. Comprobar X-Admin-Key
        const providedAdminKey = req.get('X-Admin-Key') || (req.query && req.query.admin_key);
        if (adminKey && valuesMatch(adminKey, providedAdminKey)) {
            req.isAdmin = true;
            return next();
        }

        // 3. Comprobar X-API-Key (Cliente / Frontend)
        const providedClientKey = req.get('X-API-Key') || (req.query && req.query.api_key);
        if (clientKey && valuesMatch(clientKey, providedClientKey)) {
            req.isClient = true;
            return next();
        }

        // 4. Comprobar Token JWT (Bearer Token)
        const authHeader = req.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7).trim();
            const payload = verifyJwtHS256(token, jwtSecret);
            if (payload) {
                req.user = payload;
                return next();
            }
        }

        // Rechazo 401 si no cumple ninguna credencial
        return res.status(401).json({
            status: 'error',
            code: 'UNAUTHORIZED',
            error: 'Acceso no autorizado. Se requiere cabecera X-API-Key, X-Admin-Key o token Bearer JWT válido.',
            hint: 'Configura REQUIRE_AUTH=false en .env si deseas permitir acceso anónimo en este entorno.'
        });
    };
}

module.exports = {
    valuesMatch,
    verifyJwtHS256,
    createClientAuthMiddleware,
    clientAuthMiddleware: createClientAuthMiddleware()
};
