const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');
const webServerConfig = require('../config/web_server.js');
const router = require('./router.js');

let httpServer;
let httpsServer;

function getTlsCredentials() {
    const keyPath = process.env.TLS_KEY_PATH;
    const certPath = process.env.TLS_CERT_PATH;

    if (!keyPath || !certPath) {
        throw new Error('TLS_KEY_PATH y TLS_CERT_PATH son obligatorias para iniciar HTTPS');
    }

    return {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
    };
}

function initialize() {
    return new Promise((resolve, reject) => {
        let listeningServers = 0;
        const app = express();
        const credentials = getTlsCredentials();

        httpServer = http.createServer(app);
        httpsServer = https.createServer(credentials, app);

        app.use('/api', router);

        const onListening = (protocol, server) => {
            const address = server.address();
            const port = typeof address === 'object' && address ? address.port : address;

            console.log(`Web ${protocol} server listening on ${protocol}://localhost:${port}/api`);

            listeningServers += 1;
            if (listeningServers === 2) {
                resolve();
            }
        };

        httpServer.listen(webServerConfig.port, webServerConfig.host)
            .on('listening', () => onListening('http', httpServer))
            .on('error', reject);

        httpsServer.listen(webServerConfig.port_https, webServerConfig.host)
            .on('listening', () => onListening('https', httpsServer))
            .on('error', reject);
    });
}

module.exports.initialize = initialize;

function close() {
    return new Promise((resolve, reject) => {
        let closedServers = 0;
        const onClosed = error => {
            if (error) {
                reject(error);
                return;
            }

            closedServers += 1;
            if (closedServers === 2) {
                resolve();
            }
        };

        httpServer.close(onClosed);
        httpsServer.close(onClosed);
    });
}

module.exports.close = close;
