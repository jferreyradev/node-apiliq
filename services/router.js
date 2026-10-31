const express = require('express');
const morgan = require("morgan");
const helmet = require("helmet");
const cors = require("cors");
const fs = require("fs");
const path = require('path');

const files = require('../controllers/files.js');
const importController = require('../controllers/importController.js');

const app = new express.Router();

const requestIdMiddleware = require('./requestId');
const compressionMiddleware = require('./compression');

app.use(requestIdMiddleware);
app.use(compressionMiddleware());

const control = require('../controllers/control');
const controlUser = require('../controllers/controlUsers');
const createInternalAccessMiddleware = require('./internalAccess');
const createCorsOptions = require('./corsConfig');
const adminAuth = require('./adminAuth');

app.use(express.urlencoded({ extended: false, limit: '50mb' }));

const options = {
    limit: '50mb',
    reviver: (key, value) => {
        if (typeof value === 'string') {
            const isoDateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (isoDateOnly) {
                return new Date(
                    parseInt(isoDateOnly[1], 10),
                    parseInt(isoDateOnly[2], 10) - 1,
                    parseInt(isoDateOnly[3], 10),
                    0, 0, 0
                );
            }
            if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
                const d = new Date(value);
                if (!isNaN(d.getTime())) {
                    if (
                        d.getUTCHours() === 0 &&
                        d.getUTCMinutes() === 0 &&
                        d.getUTCSeconds() === 0 &&
                        d.getHours() !== 0
                    ) {
                        return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0);
                    }
                    return d;
                }
            }
        }
        return value;
    }
};

app.use(express.json(options));

var accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' });

app.use(morgan('combined', { stream: accessLogStream }));
app.use(helmet());

app.use(createInternalAccessMiddleware());

app.use(cors(createCorsOptions()));

app.route('/status').get(adminAuth.statusHandler);
app.route('/health').get(adminAuth.statusHandler);
app.route('/admin/verify').post(adminAuth.verifyKeyHandler);
app.route('/admin/health').get(adminAuth.adminHealthHandler);
app.route('/admin/pool-status').get(adminAuth.adminAuthMiddleware, adminAuth.adminPoolStatusHandler);

app.route('/view/list').get(control.getViews);
app.route('/view/refresh').post(adminAuth.adminAuthMiddleware, control.refreshViews);
app.route('/catalog/refresh').post(adminAuth.adminAuthMiddleware, control.refreshViews);
app.route('/view/save').post(adminAuth.adminAuthMiddleware, control.saveView);
app.route('/view/upsert').post(adminAuth.adminAuthMiddleware, control.saveView);
app.route('/view/seed-from-file').post(adminAuth.adminAuthMiddleware, control.seedViewsFromFile);
app.route('/view/import-json').post(adminAuth.adminAuthMiddleware, control.importViewsJson);

app.route('/sp/list').get(control.getProc);
app.route('/sp/import-json').post(adminAuth.adminAuthMiddleware, control.importProceduresJson);
app.route('/sp/sync-oracle').post(adminAuth.adminAuthMiddleware, control.syncProceduresFromOracle);

app.route('/fn/list').get(control.getFunc);
app.route('/fn/import-json').post(adminAuth.adminAuthMiddleware, control.importProceduresJson);

app.route('/en/list').get(control.getEntities);

app.route('/repo/list').get(control.getReps);

app.route('/sp/*').post(control.execSP);

app.route('/fn/*').post(control.execFN);

app.route('/view/*')
    .get(control.getView)
    .delete(adminAuth.adminAuthMiddleware, control.deleteView);


app.route('/repo/*').get(control.getRepo);

app.route('/fileUpload').post(files.post);

app.route('/xlsx/*').get(control.getxlsx);

app.route('/txt/*').get(control.getTXT);

app.route('/txtfromsp/*').post(control.getCursorFromSP);

app.route('/adduser').post(adminAuth.adminAuthMiddleware, controlUser.post);

app.route('/boleta').get(control.getBoletaPDF2);

app.route('/generaNovIPSST').get(files.getHojaId);

app.route('/import/tables').get(adminAuth.adminAuthMiddleware, importController.getTables);
app.route('/import/table-columns/:table').get(adminAuth.adminAuthMiddleware, importController.getTableColumns);
app.route('/import/preview').post(adminAuth.adminAuthMiddleware, importController.preview);
app.route('/import/execute').post(adminAuth.adminAuthMiddleware, importController.execute);
app.route('/import/direct').post(adminAuth.adminAuthMiddleware, importController.directImport);

app.route('/*')
    .get(control.get)
    .post(control.post)
    .put(control.put)
    .delete(control.del);

app.use((err, req, res, next) => {
    const statusCode = Number.isInteger(err.statusCode) ? err.statusCode :
        Number.isInteger(err.status) ? err.status : 500;
    const safeStatusCode = statusCode >= 400 && statusCode <= 599 ? statusCode : 500;

    console.error('API request failed', {
        requestId: req.id,
        method: req.method,
        path: req.originalUrl,
        statusCode: safeStatusCode,
        code: err.code,
        message: err.message
    });

    if (res.headersSent) {
        return next(err);
    }

    const isDevOrAdmin = process.env.NODE_ENV !== 'production' || Boolean(req.get('X-Admin-Key')) || req.isAdmin;

    const message = (safeStatusCode >= 500 && !isDevOrAdmin) ?
        'Internal server error' :
        (err.message || 'Request failed');

    const responsePayload = {
        error: message,
        code: err.code || err.errorNum || undefined
    };

    if (isDevOrAdmin) {
        if (err.call || err.statement) {
            responsePayload.call = err.call || err.statement;
        }
        if (err.params || err.binds) {
            responsePayload.params = err.params || err.binds;
        }
    }
    if (err.sp) {
        responsePayload.sp = err.sp;
    }
    if (err.fn) {
        responsePayload.fn = err.fn;
    }

    res.status(safeStatusCode).json(responsePayload);
});

module.exports = app;