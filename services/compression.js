const zlib = require('zlib');

/**
 * Middleware nativo de compresión HTTP para Express sin dependencias externas.
 * Comprime respuestas JSON y texto usando Gzip o Deflate cuando el cliente lo soporta
 * y el tamaño del payload supera el umbral configurable (1 KB por defecto).
 */
function compressionMiddleware(options = {}) {
    const threshold = options.threshold !== undefined ? options.threshold : 1024; // 1 KB

    return function(req, res, next) {
        const acceptEncoding = req.headers['accept-encoding'] || '';
        const canGzip = acceptEncoding.includes('gzip');
        const canDeflate = acceptEncoding.includes('deflate');

        if (!canGzip && !canDeflate) {
            return next();
        }

        const originalSend = res.send;

        res.send = function(body) {
            res.send = originalSend;

            if (res.headersSent || req.method === 'HEAD') {
                return originalSend.call(this, body);
            }

            const cacheControl = res.getHeader('Cache-Control');
            if (cacheControl && String(cacheControl).includes('no-transform')) {
                return originalSend.call(this, body);
            }

            if (res.getHeader('Content-Encoding')) {
                return originalSend.call(this, body);
            }

            let chunk = body;
            if (typeof chunk === 'object' && !Buffer.isBuffer(chunk)) {
                if (!res.getHeader('Content-Type')) {
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                }
                chunk = JSON.stringify(chunk);
            }

            if (typeof chunk === 'string') {
                if (!res.getHeader('Content-Type')) {
                    res.setHeader('Content-Type', 'text/html; charset=utf-8');
                }
                chunk = Buffer.from(chunk, 'utf8');
            }

            if (!Buffer.isBuffer(chunk) || chunk.length < threshold) {
                return originalSend.call(this, chunk);
            }

            const encoding = canGzip ? 'gzip' : 'deflate';
            const compressFn = canGzip ? zlib.gzip : zlib.deflate;

            compressFn(chunk, (err, compressed) => {
                if (err || !compressed) {
                    return originalSend.call(this, chunk);
                }

                res.setHeader('Content-Encoding', encoding);
                res.removeHeader('Content-Length');

                const currentVary = res.getHeader('Vary');
                if (!currentVary) {
                    res.setHeader('Vary', 'Accept-Encoding');
                } else if (!String(currentVary).includes('Accept-Encoding')) {
                    res.setHeader('Vary', `${currentVary}, Accept-Encoding`);
                }

                originalSend.call(this, compressed);
            });
        };

        next();
    };
}

module.exports = compressionMiddleware;
