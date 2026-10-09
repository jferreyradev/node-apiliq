const express = require('express');
const bodyParser = require("body-parser");
const morgan = require("morgan");
const helmet = require("helmet");
const cors = require("cors");
const fs = require("fs");
const path = require('path');

const files = require('../controllers/files.js');

const app = new express.Router();

const control = require('../controllers/control');
const controlUser = require('../controllers/controlUsers');
const createInternalAccessMiddleware = require('./internalAccess');
const createCorsOptions = require('./corsConfig');
const adminAuth = require('./adminAuth');

const { json } = require('body-parser');

app.use(bodyParser.urlencoded({ extended: false }));

const options = {
    reviver: (key, value) => {
        //console.log('reviver');
        let dateTimeRegExp = /^\d{4}-\d{2}-\d{2}/;
        // T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
        if (typeof value === 'string' && dateTimeRegExp.test(value)) {
            console.log('dateeee')
            return new Date(value);
        } else {
            return value;
        }
    }
};

app.use(bodyParser.json(options));

var accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' });

app.use(morgan('combined', { stream: accessLogStream }));
app.use(helmet());

app.use(createInternalAccessMiddleware());

app.use(express.static(__dirname + '/public'));

/*
const whitelist = ['http//localhost:3005',
    'https//localhost:3003',
    'http//localhost:5173',
    'http://liq-trancas.surge.sh',
    'https://liq-trancas.surge.sh',
    'http://liq-trancas-dev.surge.sh',
    'https://liq-trancas-dev.surge.sh',
    'https://liq-dev.surge.sh',
    'http://servertrancas.duckdns.org:8090',
    'http://servertrancas.duckdns.org:8091'];


const corsOptions = {
    origin: function (origin, callback) {
        console.log(origin);
        if (whitelist.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORDS'))
        }
    }
};

/*
app.use(cors(corsOptions));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});
*/

app.use(cors(createCorsOptions()));

app.route('/admin/verify').post(adminAuth.verifyKeyHandler);

app.route('/view/list').get(control.getViews);
app.route('/view/refresh').post(adminAuth.adminAuthMiddleware, control.refreshViews);
app.route('/catalog/refresh').post(adminAuth.adminAuthMiddleware, control.refreshViews);
app.route('/view/save').post(adminAuth.adminAuthMiddleware, control.saveView);
app.route('/view/upsert').post(adminAuth.adminAuthMiddleware, control.saveView);

app.route('/sp/list').get(control.getProc);

app.route('/fn/list').get(control.getFunc);

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

app.route('/adduser').post(controlUser.post);

app.route('/boleta').get(control.getBoletaPDF2);

app.route('/generaNovIPSST').get(files.getHojaId);

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
        method: req.method,
        path: req.originalUrl,
        statusCode: safeStatusCode,
        code: err.code
    });

    if (res.headersSent) {
        return next(err);
    }

    const message = safeStatusCode >= 500 ?
        'Internal server error' :
        (err.message || 'Request failed');

    res.status(safeStatusCode).json({ error: message });
});

module.exports = app;