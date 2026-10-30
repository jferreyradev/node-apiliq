const crypto = require('crypto');

/**
 * Middleware para asignar y propagar un identificador único por petición (X-Request-Id).
 * Permite trazabilidad completa entre los logs del servidor y las consultas de los clientes.
 */
function requestIdMiddleware(req, res, next) {
    const incomingId = req.get('X-Request-Id');
    const requestId = (incomingId && incomingId.trim()) ? incomingId.trim() : crypto.randomUUID();

    req.id = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
}

module.exports = requestIdMiddleware;
