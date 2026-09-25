require('dotenv').config();

const webServer = require('./services/web_server.js');
const database = require('./services/database.js');
const dbConfig = require('./config/database.js');
const defaultThreadPoolSize = 4;

process.env.UV_THREADPOOL_SIZE = dbConfig.dbPool.poolMax + defaultThreadPoolSize;

async function startup() {
    console.log('Starting application');

    try {
        console.log('Initializing database module');

        await database.initialize();
    } catch (err) {
        console.error(err);

        process.exit(1); // Non-zero failure code
    }

    try {
        console.log('Initializing web server module');

        await webServer.initialize();
    } catch (err) {
        console.error(err);

        process.exit(1); // Non-zero failure code
    }
}

async function shutdown(e) {
    let err = e;
    console.log('Shutting down');
    
    try {
        console.log('Closing web server module');
        await webServer.close();
    } catch (e) {
        console.log('Encountered error', e);
        err = err || e;
        console.log(err);
    }

    try {
        console.log('Closing database module');
        await database.close();
    } catch (err) {
        console.log('Encountered error', e);
        err = err || e;
        console.log(err);
    }

    console.log('Exiting process');
    if (err) {
        process.exit(1); // Non-zero failure code
    } else {
        process.exit(0);
    }
}

process.on('SIGTERM', () => {
    console.log('Received SIGTERM');
    shutdown();
});

process.on('SIGINT', () => {
    console.log('Received SIGINT');
    shutdown();
});

process.on('uncaughtException', err => {
    console.log('Uncaught exception');
    console.error(err);
    shutdown(err);
});

startup();