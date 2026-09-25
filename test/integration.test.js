const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const test = require('node:test');

const apiPort = 3017;
const apiBaseUrl = `http://localhost:${apiPort}`;

function request(pathname) {
    return new Promise((resolve, reject) => {
        const request = http.get(`${apiBaseUrl}${pathname}`, response => {
            let body = '';

            response.setEncoding('utf8');
            response.on('data', chunk => {
                body += chunk;
            });
            response.on('end', () => {
                resolve({
                    statusCode: response.statusCode,
                    body
                });
            });
        });

        request.setTimeout(15000, () => {
            request.destroy(new Error(`Timeout requesting ${pathname}`));
        });
        request.on('error', reject);
    });
}

function waitForServer(child) {
    return new Promise((resolve, reject) => {
        let output = '';
        let ready = false;

        const onData = chunk => {
            output += chunk.toString();
            if (output.includes(`http://localhost:${apiPort}/api`)) {
                ready = true;
                resolve();
            }
        };

        child.stdout.on('data', onData);
        child.stderr.on('data', onData);
        child.once('error', reject);
        child.once('exit', code => {
            if (!ready) {
                reject(new Error(`API exited before listening. Output: ${output}`));
            }
        });
    });
}

test('API responde rutas básicas e integración Oracle', async t => {
    if (process.env.RUN_INTEGRATION !== '1') {
        t.skip('Usar npm run test:integration para ejecutar pruebas con Oracle');
        return;
    }

    const child = spawn(process.execPath, ['index.js'], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            HTTP_PORT: String(apiPort),
            HTTPS_PORT: '3019'
        },
        stdio: ['ignore', 'pipe', 'pipe']
    });

    try {
        await waitForServer(child);

        const entities = await request('/api/en/list');
        assert.equal(entities.statusCode, 200);

        const configServer = await request('/api/view/configServer?limit=10&offset=0');
        assert.equal(configServer.statusCode, 200);

        const missingView = await request('/api/view/noExiste');
        assert.equal(missingView.statusCode, 404);

        const missingUploadId = await request('/api/generaNovIPSST');
        assert.equal(missingUploadId.statusCode, 400);
    } finally {
        child.kill('SIGTERM');
    }
});