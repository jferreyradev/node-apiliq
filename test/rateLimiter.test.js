const assert = require('node:assert/strict');
const test = require('node:test');
const { InMemoryRateLimiter, getClientIp } = require('../services/rateLimiter');

test('getClientIp extrae la IP desde cf-connecting-ip si viene de Cloudflare', () => {
    const req = {
        headers: {
            'cf-connecting-ip': '181.87.22.100',
            'x-forwarded-for': '127.0.0.1'
        }
    };
    assert.equal(getClientIp(req), '181.87.22.100');
});

test('getClientIp extrae la primera IP de x-forwarded-for si no hay Cloudflare', () => {
    const req = {
        headers: {
            'x-forwarded-for': '200.45.10.5, 10.0.0.1'
        }
    };
    assert.equal(getClientIp(req), '200.45.10.5');
});

test('InMemoryRateLimiter permite peticiones dentro del límite y bloquea con 429 al excederlo', () => {
    const limiter = new InMemoryRateLimiter({
        windowMs: 1000,
        max: 2,
        message: 'Límite excedido'
    });
    const middleware = limiter.middleware();

    const req = { headers: {}, ip: '192.168.1.50' };

    let nextCalled = 0;
    const next = () => { nextCalled++; };

    let resStatus = 0;
    let resData = null;
    let headersSet = {};

    const createRes = () => ({
        setHeader(name, val) { headersSet[name] = val; },
        status(code) {
            resStatus = code;
            return {
                json(payload) { resData = payload; }
            };
        }
    });

    // Petición 1: debe pasar
    middleware(req, createRes(), next);
    assert.equal(nextCalled, 1);
    assert.equal(headersSet['RateLimit-Remaining'], 1);

    // Petición 2: debe pasar
    middleware(req, createRes(), next);
    assert.equal(nextCalled, 2);
    assert.equal(headersSet['RateLimit-Remaining'], 0);

    // Petición 3: debe bloquearse con 429
    middleware(req, createRes(), next);
    assert.equal(nextCalled, 2); // No llamó next
    assert.equal(resStatus, 429);
    assert.equal(resData.code, 'RATE_LIMIT_EXCEEDED');
    assert.ok(headersSet['Retry-After'] >= 1);
});
