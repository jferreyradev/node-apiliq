const assert = require('node:assert/strict');
const test = require('node:test');

const createCorsOptions = require('../services/corsConfig');

test('mantiene CORS abierto si no se configura una whitelist', () => {
    delete process.env.CORS_ORIGINS;

    assert.equal(createCorsOptions(), undefined);
});

test('permite solo los origenes configurados', () => {
    process.env.CORS_ORIGINS = 'https://app.example.com, https://admin.example.com';
    const options = createCorsOptions();
    const results = [];

    options.origin('https://app.example.com', (error, allowed) => {
        results.push({ error, allowed });
    });
    options.origin('https://other.example.com', error => {
        results.push({ error });
    });
    options.origin(undefined, (error, allowed) => {
        results.push({ error, allowed });
    });

    assert.equal(results[0].error, null);
    assert.equal(results[0].allowed, true);
    assert.equal(results[1].error.statusCode, 403);
    assert.equal(results[2].error, null);
    assert.equal(results[2].allowed, true);

    delete process.env.CORS_ORIGINS;
});