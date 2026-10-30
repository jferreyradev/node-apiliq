const path = require('path');
const fs = require('fs');
const oracledb = require('oracledb');
const dbConfig = require('../config/database');

let oracleClientInitialized = false;

function resolveOracleClientDir() {
    // 1. Variable explícita ORACLE_CLIENT_LIB_DIR
    if (process.env.ORACLE_CLIENT_LIB_DIR) {
        const customPath = path.resolve(process.env.ORACLE_CLIENT_LIB_DIR);
        if (fs.existsSync(customPath)) {
            return customPath;
        }
        console.warn(`Aviso: ORACLE_CLIENT_LIB_DIR configurado pero la ruta no existe: ${customPath}`);
    }

    // 2. Carpeta local del proyecto oracle-client/instantclient_*
    const localDir = path.resolve(__dirname, '..', 'oracle-client');
    if (fs.existsSync(localDir)) {
        try {
            const entries = fs.readdirSync(localDir);
            for (const entry of entries) {
                const fullEntry = path.join(localDir, entry);
                if (fs.statSync(fullEntry).isDirectory() && entry.startsWith('instantclient')) {
                    return fullEntry;
                }
            }
        } catch {
            // ignore
        }
    }

    // 3. Cliente Oracle instalado en el host vía ORACLE_HOME
    if (process.env.ORACLE_HOME) {
        const oracleHome = path.resolve(process.env.ORACLE_HOME);
        const winBin = path.join(oracleHome, 'bin');
        if (process.platform === 'win32' && fs.existsSync(path.join(winBin, 'oci.dll'))) {
            return winBin;
        }
        const unixLib = path.join(oracleHome, 'lib');
        if (fs.existsSync(unixLib)) {
            return unixLib;
        }
        if (fs.existsSync(oracleHome)) {
            return oracleHome;
        }
    }

    // 4. Búsqueda en PATH del sistema (donde los instaladores de Oracle agregan el directorio bin)
    if (process.env.PATH) {
        const pathDirs = process.env.PATH.split(path.delimiter);
        for (const dir of pathDirs) {
            const cleanDir = dir.trim();
            if (!cleanDir) continue;
            try {
                if (process.platform === 'win32') {
                    if (fs.existsSync(path.join(cleanDir, 'oci.dll'))) {
                        return cleanDir;
                    }
                } else {
                    if (fs.existsSync(path.join(cleanDir, 'libclntsh.so'))) {
                        return cleanDir;
                    }
                }
            } catch {
                // ignore
            }
        }
    }

    // 5. Búsqueda en Registro de Windows (HKLM\SOFTWARE\ORACLE)
    if (process.platform === 'win32') {
        try {
            const { execSync } = require('child_process');
            const regOutput = execSync('reg query HKLM\\SOFTWARE\\ORACLE /s 2>nul', { encoding: 'utf8', timeout: 1500 });
            const matches = regOutput.match(/ORACLE_HOME\s+REG_SZ\s+([^\r\n]+)/gi);
            if (matches) {
                for (const m of matches) {
                    const matchParts = m.split(/REG_SZ\s+/i);
                    if (matchParts[1]) {
                        const hDir = matchParts[1].trim();
                        const bDir = path.join(hDir, 'bin');
                        if (fs.existsSync(path.join(bDir, 'oci.dll'))) {
                            return bDir;
                        }
                    }
                }
            }
        } catch {
            // ignore
        }
    }

    // 6. Búsqueda en rutas habituales de Windows
    if (process.platform === 'win32') {
        const commonWinPaths = [
            'C:\\oracle\\instantclient_19_23',
            'C:\\oracle\\instantclient_19_24',
            'C:\\oracle\\instantclient_19_8',
            'C:\\oracle\\instantclient_23_3',
            'C:\\oracle\\instantclient_23_4',
            'C:\\instantclient',
            'C:\\oracle\\instantclient'
        ];
        for (const p of commonWinPaths) {
            if (fs.existsSync(path.join(p, 'oci.dll'))) {
                return p;
            }
        }
    }

    // 5. Búsqueda en rutas habituales de Linux
    if (process.platform === 'linux') {
        const commonLinuxPaths = [
            '/usr/lib/oracle/23/client64/lib',
            '/usr/lib/oracle/21/client64/lib',
            '/usr/lib/oracle/19.23/client64/lib',
            '/usr/lib/oracle/19.22/client64/lib',
            '/usr/lib/oracle/19.21/client64/lib',
            '/usr/lib/oracle/19.20/client64/lib',
            '/usr/lib/oracle/19.19/client64/lib',
            '/opt/oracle/instantclient_23_4',
            '/opt/oracle/instantclient_23_3',
            '/opt/oracle/instantclient_21_13',
            '/opt/oracle/instantclient_19_23',
            '/opt/oracle/instantclient_19_8'
        ];
        for (const p of commonLinuxPaths) {
            if (fs.existsSync(p)) {
                return p;
            }
        }
    }

    return null;
}

function initializeOracleClient() {
    if (oracleClientInitialized) {
        return;
    }

    const resolvedLibDir = resolveOracleClientDir();

    try {
        if (resolvedLibDir) {
            oracledb.initOracleClient({ libDir: resolvedLibDir });
            console.log(`Oracle Client (Thick Mode) cargado desde: ${resolvedLibDir} (${oracledb.oracleClientVersionString || 'detectado'})`);
        } else {
            // Intentar cargar librerías del sistema operativo (LD_LIBRARY_PATH, ldconfig, PATH)
            try {
                oracledb.initOracleClient();
                console.log(`Oracle Client cargado desde librerías del sistema (${oracledb.oracleClientVersionString || 'sistema'})`);
            } catch (sysErr) {
                console.warn('Aviso: No se inicializó Oracle Instant Client ni librerías nativas.');
                console.warn(`  Detalle del error del sistema: ${sysErr.message}`);
                console.warn(`  Plataforma: ${process.platform} (${process.arch})`);
                console.warn(`  ORACLE_HOME: ${process.env.ORACLE_HOME || 'no definido'}`);
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

async function close(drainTime = 10) {
    try {
        const pool = oracledb.getPool();
        if (pool) {
            // drainTime en segundos permite que las consultas activas finalicen antes de forzar el cierre
            await pool.close(drainTime);
            console.log(`Desconexión a BD exitosa (drainTime: ${drainTime}s).`);
        }
    } catch (err) {
        if (!err.message || !err.message.includes('NJS-047')) {
            console.warn('Aviso al cerrar el pool de conexiones:', err.message);
        }
    }
}

module.exports.close = close;

/**
 * Obtiene métricas en vivo del estado del pool de conexiones Oracle.
 */
function getPoolStats() {
    try {
        const pool = oracledb.getPool();
        if (!pool) {
            return { status: 'uninitialized', open: false, message: 'Pool de Oracle no inicializado' };
        }
        return {
            status: pool.status !== undefined ? (pool.status === oracledb.POOL_STATUS_OPEN ? 'open' : String(pool.status)) : 'open',
            open: true,
            connectionsOpen: typeof pool.connectionsOpen === 'number' ? pool.connectionsOpen : 0,
            connectionsInUse: typeof pool.connectionsInUse === 'number' ? pool.connectionsInUse : 0,
            poolMin: pool.poolMin !== undefined ? pool.poolMin : (dbConfig.dbPool ? dbConfig.dbPool.poolMin : 4),
            poolMax: pool.poolMax !== undefined ? pool.poolMax : (dbConfig.dbPool ? dbConfig.dbPool.poolMax : 10),
            poolIncrement: pool.poolIncrement !== undefined ? pool.poolIncrement : (dbConfig.dbPool ? dbConfig.dbPool.poolIncrement : 1),
            poolTimeout: pool.poolTimeout !== undefined ? pool.poolTimeout : (dbConfig.dbPool ? dbConfig.dbPool.poolTimeout : 60)
        };
    } catch (_) {
        return {
            status: 'uninitialized',
            open: false,
            message: 'Pool de Oracle no disponible o no inicializado'
        };
    }
}

module.exports.getPoolStats = getPoolStats;

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
            err.statement = query || statement;
            err.binds = binds;
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
            err.statement = statement;
            err.binds = binds;
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