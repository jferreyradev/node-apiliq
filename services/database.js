const path = require('path');
const fs = require('fs');
const oracledb = require('oracledb');
const dbConfig = require('../config/database');

let oracleClientInitialized = false;

function initializeOracleClient() {
    if (oracleClientInitialized) {
        return;
    }

    const customPath = process.env.ORACLE_CLIENT_LIB_DIR ? path.resolve(process.env.ORACLE_CLIENT_LIB_DIR) : null;
    const defaultLocalPath = path.resolve(__dirname, '..', 'oracle-client', 'instantclient_23_3');

    try {
        if (customPath) {
            if (!fs.existsSync(customPath)) {
                throw new Error(`La ruta configurada en ORACLE_CLIENT_LIB_DIR no existe: ${customPath}`);
            }
            oracledb.initOracleClient({ libDir: customPath });
            console.log(`Oracle Client cargado desde: ${customPath}`);
        } else if (fs.existsSync(defaultLocalPath)) {
            oracledb.initOracleClient({ libDir: defaultLocalPath });
            console.log(`Oracle Client cargado desde carpeta local: ${defaultLocalPath}`);
        } else {
            // Intentar cargar librerías del sistema operativo (LD_LIBRARY_PATH, ldconfig, PATH)
            try {
                oracledb.initOracleClient();
                console.log(`Oracle Client cargado desde librerías del sistema (${oracledb.oracleClientVersionString || 'sistema'})`);
            } catch (sysErr) {
                console.warn('Aviso: No se inicializó Oracle Instant Client local ni de sistema.');
                console.warn('Se intentará conectar en modo Thin (Puro JS). Nota: Si la BD es Oracle 11g se requiere Instant Client.');
            }
        }
    } catch (err) {
        console.error('Error al inicializar Oracle Client:', err.message);
        throw err;
    }

    // En Oracle 11g y posteriores, convertir CLOBs automáticamente a string de JavaScript
    oracledb.fetchAsString = [ oracledb.CLOB ];
    oracleClientInitialized = true;
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