const crypto = require('crypto');

function valuesMatch(expected, provided) {
    if (!expected || !provided) {
        return false;
    }

    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(provided);

    return expectedBuffer.length === providedBuffer.length &&
        crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function createInternalAccessMiddleware(options = {}) {
    const required = options.required ?? process.env.REQUIRE_INTERNAL_KEY === 'true';
    const expectedKey = options.key ?? process.env.API_INTERNAL_KEY;

    return (req, res, next) => {
        if (!required) {
            return next();
        }

        if (!expectedKey) {
            return res.status(503).json({ error: 'Internal access is not configured' });
        }

        if (!valuesMatch(expectedKey, req.get('X-Internal-Key'))) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        return next();
    };
}

module.exports = createInternalAccessMiddleware;