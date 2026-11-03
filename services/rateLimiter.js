/**
 * Limitador de tasa (Rate Limiter) en memoria para protección anti-fuerza bruta y anti-DDoS.
 * Soporta túneles de Cloudflare (cf-connecting-ip), proxies reversos (x-forwarded-for) e IPs directas.
 */

function getClientIp(req) {
    const cfIp = req.headers['cf-connecting-ip'];
    if (cfIp) return String(cfIp).trim();

    const xff = req.headers['x-forwarded-for'];
    if (xff) {
        const first = String(xff).split(',')[0].trim();
        if (first) return first;
    }

    return req.ip || req.connection?.remoteAddress || '127.0.0.1';
}

class InMemoryRateLimiter {
    constructor({ windowMs = 60000, max = 100, message = 'Demasiadas peticiones. Intenta más tarde.' } = {}) {
        this.windowMs = windowMs;
        this.max = max;
        this.message = message;
        this.hits = new Map();

        // Limpieza periódica de marcas de tiempo viejas para no consumir RAM
        const interval = setInterval(() => this.cleanup(), Math.max(windowMs, 30000));
        if (interval.unref) interval.unref();
    }

    cleanup() {
        const now = Date.now();
        const threshold = now - this.windowMs;
        for (const [ip, timestamps] of this.hits.entries()) {
            const valid = timestamps.filter(t => t > threshold);
            if (valid.length === 0) {
                this.hits.delete(ip);
            } else {
                this.hits.set(ip, valid);
            }
        }
    }

    reset() {
        this.hits.clear();
    }

    middleware() {
        return (req, res, next) => {
            const ip = getClientIp(req);
            const now = Date.now();
            const threshold = now - this.windowMs;

            let timestamps = this.hits.get(ip) || [];
            timestamps = timestamps.filter(t => t > threshold);

            if (timestamps.length >= this.max) {
                const oldest = timestamps[0];
                const retryAfterSeconds = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));

                res.setHeader('Retry-After', retryAfterSeconds);
                res.setHeader('RateLimit-Limit', this.max);
                res.setHeader('RateLimit-Remaining', 0);
                res.setHeader('RateLimit-Reset', Math.ceil((oldest + this.windowMs) / 1000));

                return res.status(429).json({
                    status: 'error',
                    code: 'RATE_LIMIT_EXCEEDED',
                    error: this.message,
                    retryAfterSeconds
                });
            }

            timestamps.push(now);
            this.hits.set(ip, timestamps);

            res.setHeader('RateLimit-Limit', this.max);
            res.setHeader('RateLimit-Remaining', Math.max(0, this.max - timestamps.length));
            res.setHeader('RateLimit-Reset', Math.ceil((now + this.windowMs) / 1000));

            next();
        };
    }
}

// 1. Limiter estricto para autenticación y rutas de administración (15 intentos / minuto)
const authLimiter = new InMemoryRateLimiter({
    windowMs: 60 * 1000,
    max: 15,
    message: 'Demasiados intentos de acceso o administración. Por seguridad, espera 1 minuto antes de reintentar.'
});

// 2. Limiter general para prevenir saturación del pool de Oracle (300 req / minuto por IP)
const generalLimiter = new InMemoryRateLimiter({
    windowMs: 60 * 1000,
    max: 300,
    message: 'Límite de consultas por minuto alcanzado. Intenta nuevamente en unos segundos.'
});

module.exports = {
    getClientIp,
    InMemoryRateLimiter,
    authLimiter: authLimiter.middleware(),
    generalLimiter: generalLimiter.middleware(),
    _authLimiterInstance: authLimiter,
    _generalLimiterInstance: generalLimiter
};
