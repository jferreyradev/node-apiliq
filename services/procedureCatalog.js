const fs = require('fs');
const path = require('path');
const database = require('./database');
const spmapper = require('../config/spmapper');
const fnmapper = require('../config/fnmapper');

let spmapperGenerated = null;
try {
    spmapperGenerated = require('../config/spmapper.generated');
} catch (_) {}

let fnmapperGenerated = null;
try {
    fnmapperGenerated = require('../config/fnmapper.generated');
} catch (_) {}

function loadLocalJsonMapper(fileName) {
    try {
        const filePath = path.resolve(__dirname, '..', 'config', fileName);
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(raw);
        }
    } catch (_) {}
    return {};
}

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
    'personas': 'PKG_PERSONAS',
    'persona': 'PKG_PERSONAS',
    'pers': 'PKG_PERSONAS',
    'cargos': 'MOD_CARGOS',
    'cargo': 'MOD_CARGOS',
    'cargosfam': 'PKG_CARGA_FAMILIAR',
    'cargafam': 'PKG_CARGA_FAMILIAR',
    'cargafamiliar': 'PKG_CARGA_FAMILIAR',
    'djprev': 'PKG_DDJJ_PREVISIONAL',
    'cambioperiodo': 'MOD_CAMBIO_PERIODO',
    'transnov': 'MOD_TRANS_NOV',
    'exportacion': 'MOD_EXPORTACION',
    'exp': 'MOD_EXPORTACION',
    'maestros': 'MOD_MAESTROS',
    'seg': 'MOD_SEG',
    'sac': 'MOD_SAC',
    'postliq': 'MOD_POST_LIQ',
    'doc': 'MOD_DOC',
    'paramddjj': 'PKG_PARAM_DDJJ',
    'ddjj': 'PKG_PARAM_DDJJ',
    'conceptoliq': 'PKG_CONCEPTOLIQ',
    'hojanov': 'MOD_HOJA_NOV',
    'hoja': 'MOD_NOV'
};

// Aliases rápidos a nombres canónicos en spmapper (latencia 0 ms)
const SP_ALIASES = {
    'persupd': 'PersonaUpd',
    'persins': 'PersonaIns',
    'persdel': 'PersonaDel',
    'personaupd': 'PersonaUpd',
    'personains': 'PersonaIns',
    'personadel': 'PersonaDel',
    'hojains': 'HojaIns',
    'hojaupd': 'HojaUpd',
    'hojadel': 'HojaDel',
    'hojaupdestado': 'HojaUpdEstado',
    'cargafamins': 'CargaFamIns',
    'cargafamupd': 'CargaFamUpd',
    'cargafamdel': 'CargaFamDel',
    'novvariasins': 'NovVariasIns',
    'novvariasupd': 'NovVariasUpd',
    'novvariasdel': 'NovVariasDel',
    'novvariasestado': 'NovVariasEstado',
    'novaltasins': 'NovAltasIns',
    'novaltasupd': 'NovAltasUpd',
    'novaltasdel': 'NovAltasDel',
    'novaltasestado': 'NovAltasEstado',
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

    const crudMatch = cleaned.match(/^(pers|persona|cargafam|cargo|hoja|novvarias|novaltas)(ins|upd|del)$/i);
    if (crudMatch) {
        const prefix = crudMatch[1].toLowerCase();
        const op = crudMatch[2].toLowerCase();
        const opPrefix = op === 'ins' ? 'SPI' : op === 'upd' ? 'SPU' : 'SPD';

        let entityName = prefix.toUpperCase();
        if (prefix === 'pers' || prefix === 'persona') entityName = 'PERSONA';
        if (prefix === 'cargafam') entityName = 'CARGA_FAMILIAR';
        if (prefix === 'hoja') entityName = 'HOJA_NOV';
        if (prefix === 'novvarias') entityName = 'NOV_VARIAS';
        if (prefix === 'novaltas') entityName = 'NOV_ALTAS';

        const mappedPkg = PACKAGE_PREFIXES[prefix] || `MOD_${prefix.toUpperCase()}`;
        return {
            pkgName: mappedPkg,
            procName: `${opPrefix}_${entityName}`
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
        if (io === 'IN' || (isFunction && io === 'IN/OUT')) {
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
            out_param: outParams.length > 0 ? outParams : []
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

    // 1. Caché en RAM (0ms)
    if (spCache.has(spName)) {
        return spCache.get(spName);
    }

    const lowerName = spName.toLowerCase();

    // 2. Mapeo histórico en spmapper.js (Garantía retrocompatible de nombres existentes)
    if (spmapper && spmapper.jsonStoreProcedure && spmapper.jsonStoreProcedure[spName]) {
        const legacyConfig = spmapper.jsonStoreProcedure[spName];
        spCache.set(spName, legacyConfig);
        return legacyConfig;
    }

    // 2.1 Alias conocidos a nombres canónicos (ej: persUpd -> PersonaUpd)
    const aliasTarget = SP_ALIASES[lowerName];
    if (aliasTarget && spmapper && spmapper.jsonStoreProcedure && spmapper.jsonStoreProcedure[aliasTarget]) {
        const aliasConfig = spmapper.jsonStoreProcedure[aliasTarget];
        spCache.set(spName, aliasConfig);
        return aliasConfig;
    }

    // 2.2 Búsqueda insensible a mayúsculas/minúsculas en spmapper.js
    if (spmapper && spmapper.jsonStoreProcedure) {
        for (const [k, v] of Object.entries(spmapper.jsonStoreProcedure)) {
            if (k.toLowerCase() === lowerName) {
                spCache.set(spName, v);
                return v;
            }
        }
    }

    // 3. Mapeo generado desde Oracle (715 SPs)
    if (spmapperGenerated && spmapperGenerated.jsonStoreProcedure && spmapperGenerated.jsonStoreProcedure[spName]) {
        const genConfig = spmapperGenerated.jsonStoreProcedure[spName];
        spCache.set(spName, genConfig);
        return genConfig;
    }

    // 3.1 Búsqueda insensible a mayúsculas/minúsculas en spmapperGenerated
    if (spmapperGenerated && spmapperGenerated.jsonStoreProcedure) {
        for (const [k, v] of Object.entries(spmapperGenerated.jsonStoreProcedure)) {
            if (k.toLowerCase() === lowerName) {
                spCache.set(spName, v);
                return v;
            }
        }
    }

    // 4. Introspección en vivo desde Oracle
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

    const lowerName = fnName.toLowerCase();

    // 2. Mapeo histórico en fnmapper.js
    if (fnmapper && fnmapper.jsonStoreFunction && fnmapper.jsonStoreFunction[fnName]) {
        const legacyConfig = fnmapper.jsonStoreFunction[fnName];
        fnCache.set(fnName, legacyConfig);
        return legacyConfig;
    }

    // 2.1 Búsqueda insensible a mayúsculas/minúsculas en fnmapper.js
    if (fnmapper && fnmapper.jsonStoreFunction) {
        for (const [k, v] of Object.entries(fnmapper.jsonStoreFunction)) {
            if (k.toLowerCase() === lowerName) {
                fnCache.set(fnName, v);
                return v;
            }
        }
    }

    // 3. Mapeo generado desde Oracle
    if (fnmapperGenerated && fnmapperGenerated.jsonStoreFunction && fnmapperGenerated.jsonStoreFunction[fnName]) {
        const genConfig = fnmapperGenerated.jsonStoreFunction[fnName];
        fnCache.set(fnName, genConfig);
        return genConfig;
    }

    // 3.1 Búsqueda insensible a mayúsculas/minúsculas en fnmapperGenerated
    if (fnmapperGenerated && fnmapperGenerated.jsonStoreFunction) {
        for (const [k, v] of Object.entries(fnmapperGenerated.jsonStoreFunction)) {
            if (k.toLowerCase() === lowerName) {
                fnCache.set(fnName, v);
                return v;
            }
        }
    }

    // 4. Introspección en vivo desde Oracle
    const discovered = await introspectFromOracle(fnName);
    if (discovered && discovered.isFunction && discovered.config) {
        fnCache.set(fnName, discovered.config);
        return discovered.config;
    }

    return null;
}

/**
 * Retorna todos los procedimientos conocidos (generados + históricos + locales + descubiertos en RAM).
 */
async function getAllSp() {
    const all = {};
    if (spmapperGenerated && spmapperGenerated.jsonStoreProcedure) {
        Object.assign(all, spmapperGenerated.jsonStoreProcedure);
    }
    if (spmapper && spmapper.jsonStoreProcedure) {
        Object.assign(all, spmapper.jsonStoreProcedure);
    }
    const localSp = loadLocalJsonMapper('spmapper.local.json');
    if (localSp && typeof localSp === 'object') {
        Object.assign(all, localSp);
    }
    for (const [key, val] of spCache.entries()) {
        all[key] = val;
    }
    return all;
}

/**
 * Retorna todas las funciones conocidas (generadas + históricas + locales + descubiertas en RAM).
 */
async function getAllFn() {
    const all = {};
    if (fnmapperGenerated && fnmapperGenerated.jsonStoreFunction) {
        Object.assign(all, fnmapperGenerated.jsonStoreFunction);
    }
    if (fnmapper && fnmapper.jsonStoreFunction) {
        Object.assign(all, fnmapper.jsonStoreFunction);
    }
    const localFn = loadLocalJsonMapper('fnmapper.local.json');
    if (localFn && typeof localFn === 'object') {
        Object.assign(all, localFn);
    }
    for (const [key, val] of fnCache.entries()) {
        all[key] = val;
    }
    return all;
}

/**
 * Importa definiciones de SPs y/o Funciones desde un objeto JSON hacia la caché RAM y archivos locales (.local.json).
 */
function importProceduresFromObject(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('Se esperaba un objeto JSON con las definiciones de procedimientos o funciones');
    }

    const spSource = payload.jsonStoreProcedure || payload.sp || null;
    const fnSource = payload.jsonStoreFunction || payload.fn || null;

    let importedSp = 0;
    let importedFn = 0;
    const localSp = loadLocalJsonMapper('spmapper.local.json');
    const localFn = loadLocalJsonMapper('fnmapper.local.json');

    if (spSource || fnSource) {
        if (spSource && typeof spSource === 'object') {
            for (const [name, cfg] of Object.entries(spSource)) {
                if (cfg && typeof cfg === 'object' && cfg.sp_name) {
                    spCache.set(name, cfg);
                    localSp[name] = cfg;
                    importedSp++;
                }
            }
        }
        if (fnSource && typeof fnSource === 'object') {
            for (const [name, cfg] of Object.entries(fnSource)) {
                if (cfg && typeof cfg === 'object' && cfg.fn_name) {
                    fnCache.set(name, cfg);
                    localFn[name] = cfg;
                    importedFn++;
                }
            }
        }
    } else {
        for (const [name, cfg] of Object.entries(payload)) {
            if (!cfg || typeof cfg !== 'object') continue;
            if (cfg.sp_name) {
                spCache.set(name, cfg);
                localSp[name] = cfg;
                importedSp++;
            } else if (cfg.fn_name) {
                fnCache.set(name, cfg);
                localFn[name] = cfg;
                importedFn++;
            }
        }
    }

    try {
        const configDir = path.resolve(__dirname, '..', 'config');
        if (importedSp > 0) {
            fs.writeFileSync(path.join(configDir, 'spmapper.local.json'), JSON.stringify(localSp, null, 2), 'utf-8');
        }
        if (importedFn > 0) {
            fs.writeFileSync(path.join(configDir, 'fnmapper.local.json'), JSON.stringify(localFn, null, 2), 'utf-8');
        }
    } catch (_) {}

    return {
        importedSp,
        importedFn,
        totalImported: importedSp + importedFn
    };
}

/**
 * Introspecciona todos los procedimientos y funciones disponibles en Oracle (ALL_ARGUMENTS)
 * y actualiza el catálogo en memoria.
 */
async function syncAllFromOracle(targetSchema = 'US_SUELDO', targetPackage = null) {
    const generator = require('../scripts/generate_mappers');
    const schema = (targetSchema || process.env.TARGET_SCHEMA || 'US_SUELDO').toUpperCase();
    const binds = { targetSchema: schema };
    let pkgFilter = '';

    if (targetPackage && String(targetPackage).trim()) {
        const cleanPkg = String(targetPackage).trim().toUpperCase();
        if (cleanPkg.includes('%')) {
            pkgFilter = ' AND UPPER(package_name) LIKE :targetPackage';
        } else {
            pkgFilter = ' AND UPPER(package_name) = :targetPackage';
        }
        binds.targetPackage = cleanPkg;
    }

    const query = `
        SELECT 
            package_name,
            object_name,
            NVL(overload, '0') AS overload,
            argument_name,
            position,
            sequence,
            data_type,
            in_out
        FROM all_arguments
        WHERE owner = :targetSchema
          AND data_level = 0
          ${pkgFilter}
        ORDER BY 
            NVL(package_name, object_name),
            object_name,
            NVL(overload, '0'),
            sequence
    `;

    const result = await database.simpleExecute(query, binds);
    const rows = (result && result.rows) ? result.rows : [];
    const objects = generator.groupObjects(rows);
    const procedures = objects.filter(o => !o.isFunction);
    const functions = objects.filter(o => o.isFunction);

    const existingSp = (spmapper && spmapper.jsonStoreProcedure) ? spmapper.jsonStoreProcedure : {};
    const existingFn = (fnmapper && fnmapper.jsonStoreFunction) ? fnmapper.jsonStoreFunction : {};

    const generatedSp = generator.generateSpMapper(procedures, existingSp);
    const generatedFn = generator.generateFnMapper(functions, existingFn);

    for (const [k, v] of Object.entries(generatedSp)) {
        spCache.set(k, v);
    }
    for (const [k, v] of Object.entries(generatedFn)) {
        fnCache.set(k, v);
    }

    return {
        schema,
        spCount: Object.keys(generatedSp).length,
        fnCount: Object.keys(generatedFn).length,
        sp: generatedSp,
        fn: generatedFn
    };
}

module.exports = {
    getSpConfig,
    getFnConfig,
    getAllSp,
    getAllFn,
    clearCache,
    resolveNameParts,
    buildConfigFromRows,
    importProceduresFromObject,
    syncAllFromOracle,
    _spCache: spCache,
    _fnCache: fnCache
};
