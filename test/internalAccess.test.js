const assert = require('node:assert/strict');
const test = require('node:test');

const createInternalAccessMiddleware = require('../services/internalAccess');

function responseRecorder() {
    return {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
}

function requestWithKey(key) {
    return {
        get(header) {
            return header === 'X-Internal-Key' ? key : undefined;
        }
    };
}

test('mantiene el acceso cuando la protección está desactivada', () => {
    let called = false;
    const middleware = createInternalAccessMiddleware({ required: false });

    middleware(requestWithKey(), responseRecorder(), () => {
        called = true;
    });

    assert.equal(called, true);
});

test('responde 503 si falta la clave configurada', () => {
    const response = responseRecorder();
    const middleware = createInternalAccessMiddleware({ required: true });

    middleware(requestWithKey('key'), response, () => {});

    assert.equal(response.statusCode, 503);
});

test('responde 403 con una clave incorrecta', () => {
    const response = responseRecorder();
    const middleware = createInternalAccessMiddleware({ required: true, key: 'expected' });

    middleware(requestWithKey('wrong'), response, () => {});

    assert.equal(response.statusCode, 403);
});

test('permite la solicitud con la clave correcta', () => {
    let called = false;
    const middleware = createInternalAccessMiddleware({ required: true, key: 'expected' });

    middleware(requestWithKey('expected'), responseRecorder(), () => {
        called = true;
    });

    assert.equal(called, true);
});