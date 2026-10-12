const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const express = require('express');
const webServerConfig = require('../config/web_server.js');
const router = require('./router.js');

let httpServer;
let httpsServer;

function getTlsCredentials() {
    if (process.env.ENABLE_HTTPS !== 'true') {
        return null;
    }

    const defaultKey = path.resolve(__dirname, '..', 'certs', 'server.key');
    const defaultCert = path.resolve(__dirname, '..', 'certs', 'server.crt');

    const keyPath = process.env.TLS_KEY_PATH || (fs.existsSync(defaultKey) ? defaultKey : null);
    const certPath = process.env.TLS_CERT_PATH || (fs.existsSync(defaultCert) ? defaultCert : null);

    const hasCert = keyPath && certPath && fs.existsSync(keyPath) && fs.existsSync(certPath);

    if (!hasCert) {
        if (process.env.ENABLE_HTTPS === 'true') {
            throw new Error('ENABLE_HTTPS=true pero TLS_KEY_PATH y TLS_CERT_PATH son inválidas o inexistentes');
        }
        return null;
    }

    return {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
    };
}

function initialize() {
    return new Promise((resolve, reject) => {
        const app = express();

        const enableAdminStudio = process.env.ENABLE_ADMIN_STUDIO !== 'false';
        if (enableAdminStudio) {
            const adminPath = path.resolve(__dirname, 'public', 'admin');
            app.use('/admin', (req, res, next) => {
                res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
                next();
            }, express.static(adminPath));
            app.get('/admin', (req, res) => {
                res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
                res.sendFile(path.join(adminPath, 'index.html'));
            });
            app.get('/', (req, res) => {
                res.redirect('/admin');
            });
        }

        app.use('/api', router);

        const credentials = getTlsCredentials();
        const enableHttps = credentials !== null;
        const targetServers = enableHttps ? 2 : 1;
        let listeningServers = 0;

        const onListening = (protocol, server) => {
            const address = server.address();
            const port = typeof address === 'object' && address ? address.port : address;

            console.log(`Web ${protocol} server listening on ${protocol}://localhost:${port}/api`);
            if (enableAdminStudio) {
                console.log(`Admin Studio disponible en: ${protocol}://localhost:${port}/admin`);
            }

            listeningServers += 1;
            if (listeningServers === targetServers) {
                resolve();
            }
        };

        httpServer = http.createServer(app);
        httpServer.listen(webServerConfig.port, webServerConfig.host)
            .on('listening', () => onListening('http', httpServer))
            .on('error', reject);

        if (enableHttps) {
            httpsServer = https.createServer(credentials, app);
            httpsServer.listen(webServerConfig.port_https, webServerConfig.host)
                .on('listening', () => onListening('https', httpsServer))
                .on('error', reject);
        } else {
            console.log('HTTPS deshabilitado. Servidor iniciado solo en HTTP.');
        }
    });
}

module.exports.initialize = initialize;

function close() {
    return new Promise((resolve, reject) => {
        const activeServers = [httpServer, httpsServer].filter(Boolean);
        if (activeServers.length === 0) {
            return resolve();
        }

        let closedServers = 0;
        const onClosed = error => {
            if (error) {
                reject(error);
                return;
            }

            closedServers += 1;
            if (closedServers === activeServers.length) {
                resolve();
            }
        };

        for (const server of activeServers) {
            server.close(onClosed);
        }
    });
}

module.exports.close = close;
