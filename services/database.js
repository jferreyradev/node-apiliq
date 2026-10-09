const path = require('path');
const fs = require('fs');
const oracledb = require('oracledb');
const dbConfig = require('../config/database');

const oracleClientPath = process.env.ORACLE_CLIENT_LIB_DIR ||
    path.resolve(
        __dirname,
        '..',
        'oracle-client',
        'instantclient_23_3'
    );

let oracleClientInitialized = false;

function initializeOracleClient() {
    if (oracleClientInitialized) {
        return;
    }

    if (!fs.existsSync(oracleClientPath)) {
        throw new Error(
            `No existe Oracle Instant Client en: ${oracleClientPath}`
        );
    }

    oracledb.initOracleClient({
        libDir: oracleClientPath
    });

    // En Oracle 11g y posteriores, convertir CLOBs automáticamente a string de JavaScript
    oracledb.fetchAsString = [ oracledb.CLOB ];

    oracleClientInitialized = true;

    console.log(
        `Oracle Client cargado desde: ${oracleClientPath}`
    );
}

async function initialize() {
    initializeOracleClient();

    await oracledb.createPool(dbConfig.dbPool);

    console.log(
        `Conexión a BD establecida: ${dbConfig.dbPool.user}@${dbConfig.dbPool.connectionString}`
    );
}

module.exports.initialize = initialize;

/*
const oracledb = require('oracledb');
const dbConfig = require('../config/database');

async function initialize() {
    //console.log(dbConfig.dbPool)
    const pool = await oracledb.createPool(dbConfig.dbPool);
    console.log('Conexión a BD establecida.');
}

module.exports.initialize = initialize;
*/

async function close() {
    await oracledb.getPool().close();
    console.log('Desconexión a BD.');
}

module.exports.close = close;

function getQueryLimits(query) {
    return `SELECT * FROM (SELECT A.*, ROWNUM AS MY_RNUM FROM ( ${query} ) A
             WHERE ROWNUM <= :limit + :offset) WHERE MY_RNUM > :offset`;
}

function simpleExecute(statement, binds = [], opts = {}) {
    return new Promise(async (resolve, reject) => {
        let conn;
        let query;
        opts.outFormat = oracledb.OBJECT;
        opts.autoCommit = true;
        try {
            conn = await oracledb.getConnection();
            if (binds.limit !== undefined) {
                if (binds.offset == undefined) {
                    binds.offset = 0;
                }
                query = getQueryLimits(statement);
            } else {
                query = statement;
            }         
            const result = await conn.execute(query, binds, opts);
            resolve(result);
        } catch (err) {
            reject(err);
        } finally {
            if (conn) {
                try {
                    await conn.close();
                } catch (err) {
                    console.log(err);
                }
            }
        }
    })
}

module.exports.simpleExecute = simpleExecute;


function simpleExecuteNoLimit(statement, binds = [], opts = {}) {
    return new Promise(async (resolve, reject) => {
        let conn;
        let query;
        opts.outFormat = oracledb.OBJECT;
        opts.autoCommit = true;
        try {
            conn = await oracledb.getConnection();          
            const result = await conn.execute(statement, binds, opts);
            resolve(result);
        } catch (err) {
            reject(err);
        } finally {
            if (conn) {
                try {
                    await conn.close();
                } catch (err) {
                    console.log(err);
                }
            }
        }
    })
}

module.exports.exec = simpleExecuteNoLimit;

async function getConnection() {
    return await oracledb.getConnection();
}

module.exports.getConnection = getConnection;