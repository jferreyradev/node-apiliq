const database = require('./database');
const spmapper = require('../config/spmapper');
const fnmapper = require('../config/fnmapper');

// Caché en memoria RAM para SPs y FNs (0ms de latencia)
const spCache = new Map();
const fnCache = new Map();

// Diccionario de paquetes comunes para resolución rápida de prefijos
const PACKAGE_PREFIXES = {
    'nov': 'MOD_NOV',
    'modnov': 'MOD_NOV',
    'liq': 'MOD_LIQUIDACION',
    'modliq': 'MOD_LIQUIDACION',
    'fn': 'MOD_FUNCIONES',
    'repo': 'MOD_REPORTES',
    'acred': 'MOD_ACREDITACION',
    'param': 'MOD_PARAM',
    'personas': 'MOD_PERSONAS',
    'cargos': 'MOD_CARGOS',
    'cargosfam': 'PKG_CARGA_FAMILIAR',
    'cargafam': 'PKG_CARGA_FAMILIAR',
    'djprev': 'PKG_DDJJ_PREVISIONAL',
    'cambioperiodo': 'MOD_CAMBIO_PERIODO',
    'transnov': 'MOD_TRANS_NOV'
};

function clearCache() {
    spCache.clear();
    fnCache.clear();
}

function cleanProcName(proc) {
    if (!proc) return '';
    return proc.replace(/^(P_|SP_|FN_|F_)/i, '');
}

function toPascalCase(str) {
    if (!str) return '';
    const cleaned = str.replace(/^(P_|V_|IN_|OUT_)/i, '');
    return cleaned
        .toLowerCase()
        .replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase())
        .replace(/^[a-z]/, letter => letter.toUpperCase());
}

function formatInParam(argName) {
    if (!argName) return '';
    const upper = argName.toUpperCase();
    if (upper.startsWith('VID') || upper.startsWith('V_ID')) {
        const rest = upper.replace(/^V_?ID_?/, '');
        return `vID${rest}`;
    }
    return toPascalCase(argName);
}


function formatOutParam(argName, dataType) {
    const upper = (argName || '').toUpperCase();
    const typeUpper = (dataType || '').toUpperCase();

    if (typeUpper === 'REF CURSOR' || upper.includes('CURSOR')) {
        return 'Cursor';
    }
    if (upper.includes('VALORSALIDA') || upper.includes('SALIDA') || upper === 'P_VALOR_SALIDA') {
        return 'ValorSalida';
    }
    if (upper.includes('VALORERROR') || upper.includes('ERROR') || upper === 'P_VALOR_ERROR') {
        return 'ValorError';
    }
    if (upper.includes('MSG') || upper.includes('MENSAJE') || upper === 'P_ERROR_MSG') {
        return 'msg';
    }
    const cleaned = (argName || 'out').replace(/^(P_|V_|OUT_)/i, '');
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function toSnakeCase(str) {
    if (!str) return '';
    if (str === str.toUpperCase()) {
        return str;
    }
    return str
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .toUpperCase();
}

/**
 * Resuelve el nombre del paquete y procedimiento desde un alias como:
 * - 'nov_spiHojaNov' -> pkg: 'MOD_NOV', proc: 'SPI_HOJA_NOV'
 * - 'MOD_NOV.SPI_HOJA_NOV' -> pkg: 'MOD_NOV', proc: 'SPI_HOJA_NOV'
 * - 'spiHojaNov' -> pkg: null, proc: 'SPI_HOJA_NOV'
 */
function resolveNameParts(rawName) {
    const cleaned = (rawName || '').trim();

    if (cleaned.includes('.')) {
        const parts = cleaned.split('.');
        return {
            pkgName: parts[0].toUpperCase(),
            procName: toSnakeCase(parts[1])
        };
    }

    if (cleaned.includes('_')) {
        const idx = cleaned.indexOf('_');
        const prefix = cleaned.substring(0, idx).toLowerCase();
        const proc = cleaned.substring(idx + 1);

        const mappedPkg = PACKAGE_PREFIXES[prefix] || `MOD_${prefix.toUpperCase()}`;
        return {
            pkgName: mappedPkg,
            procName: toSnakeCase(proc)
        };
    }

    return {
        pkgName: null,
        procName: toSnakeCase(cleaned)
    };
}


/**
 * Introspección dinámica de Oracle ALL_ARGUMENTS para un Stored Procedure o Función.
 */
async function introspectFromOracle(rawName, targetSchema = 'US_SUELDO') {
    const { pkgName, procName } = resolveNameParts(rawName);

    try {
        const binds = {
            targetSchema: targetSchema.toUpperCase(),
            procName: procName
        };

        let pkgFilter = '';
        if (pkgName) {
            binds.pkgName = pkgName;
            pkgFilter = 'AND UPPER(package_name) = :pkgName';
        }

        const query = `
            SELECT 
                package_name,
                object_name,
                argument_name,
                position,
                sequence,
                data_type,
                in_out
            FROM all_arguments
            WHERE owner = :targetSchema
              AND UPPER(object_name) = :procName
              AND data_level = 0
              ${pkgFilter}
            ORDER BY sequence
        `;

        const result = await database.simpleExecute(query, binds);
        const rows = result ? result.rows : [];

        if (!rows || rows.length === 0) {
            // Si no encontró con el nombre exacto, intentar búsqueda por patrón de procedimiento
            const patternQuery = `
                SELECT 
                    package_name,
                    object_name,
                    argument_name,
                    position,
                    sequence,
                    data_type,
                    in_out
                FROM all_arguments
                WHERE owner = :targetSchema
                  AND (UPPER(object_name) LIKE '%' || :procName || '%' OR UPPER(object_name) = 'SP_' || :procName OR UPPER(object_name) = 'SPI_' || :procName OR UPPER(object_name) = 'SPU_' || :procName OR UPPER(object_name) = 'SPD_' || :procName)
                  AND data_level = 0
                  ${pkgFilter}
                ORDER BY sequence
            `;
            const retryRes = await database.simpleExecute(patternQuery, binds);
            if (retryRes && retryRes.rows && retryRes.rows.length > 0) {
                return buildConfigFromRows(retryRes.rows);
            }
            return null;
        }

        return buildConfigFromRows(rows);
    } catch (err) {
        // En caso de que la BD no responda
        return null;
    }
}

function buildConfigFromRows(rows) {
    if (!rows || rows.length === 0) return null;

    const firstRow = rows[0];
    const pkg = firstRow.PACKAGE_NAME;
    const obj = firstRow.OBJECT_NAME;
    const isFunction = rows.some(r => r.POSITION === 0);

    const inParams = [];
    const outParams = [];
    const inMap = {};

    for (const r of rows) {
        if (r.POSITION === 0) continue; // Valor de retorno de función
        if (!r.ARGUMENT_NAME) continue;

        const io = (r.IN_OUT || 'IN').toUpperCase();
        if (io === 'IN' || io === 'IN/OUT') {
            const formatted = formatInParam(r.ARGUMENT_NAME);
            inParams.push(formatted);
            inMap[formatted] = r.ARGUMENT_NAME;
        }
        if (io === 'OUT' || io === 'IN/OUT') {
            outParams.push(formatOutParam(r.ARGUMENT_NAME, r.DATA_TYPE));
        }
    }

    const fullName = pkg ? `${pkg}.${obj}` : obj;

    if (isFunction) {
        return {
            isFunction: true,
            config: {
                fn_name: fullName,
                in_param: inMap,
                out_param: { varName: 'value' }
            }
        };
    }

    return {
        isFunction: false,
        config: {
            sp_name: fullName,
            in_param: inParams,
            out_param: outParams.length > 0 ? outParams : ['ValorSalida']
        }
    };
}

/**
 * Obtiene la configuración de un Stored Procedure:
 * 1. Revisa caché en RAM (0ms).
 * 2. Revisa compatibilidad histórica en config/spmapper.js.
 * 3. Introspección dinámica desde Oracle ALL_ARGUMENTS.
 */
async function getSpConfig(spName) {
    if (!spName) return null;

    // 1. Caché en RAM
    if (spCache.has(spName)) {
        return spCache.get(spName);
    }

    // 2. Mapeo histórico en spmapper.js (Garantía retrocompatible de nombres existentes)
    if (spmapper && spmapper.jsonStoreProcedure && spmapper.jsonStoreProcedure[spName]) {
        const legacyConfig = spmapper.jsonStoreProcedure[spName];
        spCache.set(spName, legacyConfig);
        return legacyConfig;
    }

    // 3. Introspección en vivo desde Oracle
    const discovered = await introspectFromOracle(spName);
    if (discovered && !discovered.isFunction && discovered.config) {
        spCache.set(spName, discovered.config);
        return discovered.config;
    }

    return null;
}

/**
 * Obtiene la configuración de una Función:
 * 1. Revisa caché en RAM (0ms).
 * 2. Revisa compatibilidad histórica en config/fnmapper.js.
 * 3. Introspección dinámica desde Oracle ALL_ARGUMENTS.
 */
async function getFnConfig(fnName) {
    if (!fnName) return null;

    // 1. Caché en RAM
    if (fnCache.has(fnName)) {
        return fnCache.get(fnName);
    }

    // 2. Mapeo histórico en fnmapper.js
    if (fnmapper && fnmapper.jsonStoreFunction && fnmapper.jsonStoreFunction[fnName]) {
        const legacyConfig = fnmapper.jsonStoreFunction[fnName];
        fnCache.set(fnName, legacyConfig);
        return legacyConfig;
    }

    // 3. Introspección en vivo desde Oracle
    const discovered = await introspectFromOracle(fnName);
    if (discovered && discovered.isFunction && discovered.config) {
        fnCache.set(fnName, discovered.config);
        return discovered.config;
    }

    return null;
}

/**
 * Retorna todos los procedimientos conocidos (históricos + descubiertos en RAM).
 */
async function getAllSp() {
    const all = {};
    if (spmapper && spmapper.jsonStoreProcedure) {
        Object.assign(all, spmapper.jsonStoreProcedure);
    }
    for (const [key, val] of spCache.entries()) {
        all[key] = val;
    }
    return all;
}

/**
 * Retorna todas las funciones conocidas (históricas + descubiertas en RAM).
 */
async function getAllFn() {
    const all = {};
    if (fnmapper && fnmapper.jsonStoreFunction) {
        Object.assign(all, fnmapper.jsonStoreFunction);
    }
    for (const [key, val] of fnCache.entries()) {
        all[key] = val;
    }
    return all;
}

module.exports = {
    getSpConfig,
    getFnConfig,
    getAllSp,
    getAllFn,
    clearCache,
    resolveNameParts,
    buildConfigFromRows,
    _spCache: spCache,
    _fnCache: fnCache
};
