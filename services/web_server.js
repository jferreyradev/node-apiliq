const path = require('path');
const http = require('http');
const express = require('express');
const webServerConfig = require('../config/web_server.js');
const router = require('./router.js');

let httpServer;

function initialize() {
    return new Promise((resolve, reject) => {
        const app = express();
        app.disable('x-powered-by');

        app.get('/', (req, res) => {
            res.json({
                service: 'node-apiliq',
                status: 'online',
                api: '/api',
                admin: 'dno-admin-bridge'
            });
        });

        app.get('/admin', (req, res) => {
            res.status(200).json({
                service: 'node-apiliq',
                status: 'online',
                message: 'Admin UI desacoplada. Utilice dno-admin-bridge para gestionar la API.'
            });
        });

        app.use('/api', router);

        httpServer = http.createServer(app);
        httpServer.listen(webServerConfig.port, webServerConfig.host)
            .on('listening', () => {
                const address = httpServer.address();
                const port = typeof address === 'object' && address ? address.port : address;
                console.log(`Web server listening on http://localhost:${port}/api`);
                resolve();
            })
            .on('error', reject);
    });
}

module.exports.initialize = initialize;

function close() {
    return new Promise((resolve, reject) => {
        if (!httpServer) {
            return resolve();
        }
        httpServer.close(err => {
            if (err) return reject(err);
            resolve();
        });
    });
}

module.exports.close = close;
