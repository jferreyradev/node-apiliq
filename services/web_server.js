const path = require('path');
const http = require('http');
const express = require('express');
const webServerConfig = require('../config/web_server.js');
const router = require('./router.js');

let httpServer;

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

        httpServer = http.createServer(app);
        httpServer.listen(webServerConfig.port, webServerConfig.host)
            .on('listening', () => {
                const address = httpServer.address();
                const port = typeof address === 'object' && address ? address.port : address;
                console.log(`Web server listening on http://localhost:${port}/api`);
                if (enableAdminStudio) {
                    console.log(`Admin Studio disponible en: http://localhost:${port}/admin`);
                }
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
