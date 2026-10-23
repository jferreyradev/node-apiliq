/**
 * Script para generar mappers de Stored Procedures y Funciones desde Oracle.
 * Configurado específicamente para el esquema US_SUELDO y agrupado por paquete.
 *
 * Ejemplos de uso:
 *
 *   1. Mapear un paquete específico (muestra el JSON y guarda en config/spmapper.<paquete>.js):
 *      node scripts/generate_mappers.js MOD_NOV
 *      node scripts/generate_mappers.js PKG_CARGA_FAMILIAR
 *
 *   2. Listar todos los paquetes disponibles en el esquema US_SUELDO:
 *      node scripts/generate_mappers.js --list
 *
 *   3. Mapear TODOS los paquetes del esquema:
 *      node scripts/generate_mappers.js --all
 *
 * Variables de entorno opcionales:
 *   TARGET_SCHEMA=US_SUELDO   (Por defecto: US_SUELDO)
 *   OVERWRITE=true            (Sobrescribe directamente config/spmapper.js)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const database = require('../services/database');

function toCamelCase(str) {
    if (!str) return '';
    const cleaned = str.replace(/^(P_|V_|IN_|OUT_)/i, '');
    return cleaned
        .toLowerCase()
        .replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase())
        .replace(/^[A-Z]/, letter => letter.toLowerCase());
}

function toPascalCase(str) {
    const camel = toCamelCase(str);
    return camel.charAt(0).toUpperCase() + camel.slice(1);
}

function cleanPackageName(pkg) {
    if (!pkg) return '';
    const upper = pkg.toUpperCase();
    const commonShortNames = {
        'MOD_FUNCIONES': 'fn',
        'MOD_LIQUIDACION': 'liq',
        'MOD_REPORTES': 'repo',
        'MOD_ACREDITACION': 'acred',
        'PKG_DDJJ_PREVISIONAL': 'djPrev',
        'PKG_CARGA_FAMILIAR': 'cargaFam'
    };
    if (commonShortNames[upper]) {
        return commonShortNames[upper];
    }
    // Quita prefijos MOD_ o PKG_
    const cleaned = pkg.replace(/^(MOD_|PKG_)/i, '');
    return toCamelCase(cleaned);
}

function cleanProcName(proc) {
    if (!proc) return '';
    let cleaned = proc;
    // Si empieza con P_, SP_, FN_ o F_ (prefijos redundantes), quitarlo
    if (/^(P_|SP_|FN_|F_)/i.test(cleaned)) {
        cleaned = cleaned.replace(/^(P_|SP_|FN_|F_)/i, '');
    }
    return toCamelCase(cleaned);
}

/**
 * Nomenclatura corta solicitada: <paquete_corto>_<procedimiento_camelCase>
 *   MOD_NOV.SPI_HOJA_NOV       -> nov_spiHojaNov
 *   MOD_NOV.SPU_HOJA_NOV       -> nov_spuHojaNov
 *   MOD_NOV.SPD_HOJA_NOV       -> nov_spdHojaNov
 *   MOD_PARAM.P_DESC_CABVALCAT -> param_descCabvalcat
 *   MOD_PERSONAS.SPI_PERSONA   -> personas_spiPersona
 */
function generateSpAlias(procName, pkgName) {
    const pkgShort = cleanPackageName(pkgName);
    const procCamel = cleanProcName(procName);

    if (!pkgShort) {
        return procCamel;
    }
    return `${pkgShort}_${procCamel}`;
}

/**
 * Normaliza nombres de parámetros IN respetando la convención de spmapper.js:
 *   vIDREP, vORDEN, vCOD, vSUBCOD, vPERIODO, vIDHOJANOV, etc.
 *   Periodo, TipoLiquidacionId, IdPersona, etc.
 */
function formatInParam(argName) {
    if (!argName) return '';
    const upper = argName.toUpperCase();

    // Parámetros con prefijo vID (ej: VIDHOJANOV -> vIDHOJANOV, VIDPERS -> vIDPERS)
    if (upper.startsWith('VID') || upper.startsWith('V_ID')) {
        const rest = upper.replace(/^V_?ID_?/, '');
        return `vID${rest}`;
    }

    // Parámetros con prefijo v (ej: vREP, vORD, vCOD, vSUBCOD, vPERIODO, vIMP, vVTO)
    if (upper.startsWith('V') && upper.length > 1 && !upper.startsWith('VALOR')) {
        const clean = upper.startsWith('V_') ? upper.substring(2) : upper.substring(1);
        const shortAbrevs = [
            'REP', 'ORD', 'AFI', 'DNI', 'CUIL', 'APE', 'NOM', 'SEXO',
            'TE', 'CC', 'CAT', 'ANTIG', 'VTO', 'TITULO', 'DIF_CAT',
            'AJUB', 'COD', 'SUBCOD', 'P1', 'P2', 'IMP', 'PERIODO',
            'FECHAGRAB', 'IDESTADOREG', 'APELLIDO', 'NOMBRE', 'DOMICILIO',
            'NRO', 'LOCALIDAD', 'PROVINCIA', 'CODPOSTAL', 'FECHAINGRESO',
            'TELEFONO', 'EMAIL', 'CUENTA', 'CBU', 'SALIDA', 'ERROR', 'ERRORMSG'
        ];
        if (shortAbrevs.includes(clean)) {
            return `v${clean}`;
        }
        return `v${clean}`;
    }

    // Parámetros con prefijo P_ (ej: P_PERIODO -> Periodo, P_ID -> Id)
    if (upper.startsWith('P_')) {
        return toPascalCase(upper.substring(2));
    }

    return toPascalCase(argName);
}

/**
 * Normaliza nombres de parámetros OUT respetando spmapper.js:
 *   'ValorSalida', 'ValorError', 'vErrorMsg', 'Cursor'
 */
function formatOutParam(argName, dataType) {
    if (dataType === 'REF CURSOR') {
        return 'Cursor';
    }
    const upper = (argName || '').toUpperCase();

    if (upper.includes('ERRORMSG') || upper.includes('ERROR_MSG')) {
        return 'vErrorMsg';
    }
    if (upper === 'VSALIDA' || upper === 'V_SALIDA' || upper === 'SALIDA') {
        return 'ValorSalida';
    }
    if (upper === 'VERROR' || upper === 'V_ERROR' || upper === 'ERROR') {
        return 'ValorError';
    }
    if (upper.includes('VALORSALIDA') || upper.includes('VALOR_SALIDA')) {
        return 'ValorSalida';
    }
    if (upper.includes('VALORERROR') || upper.includes('VALOR_ERROR')) {
        return 'ValorError';
    }

    return toPascalCase(argName || 'Salida');
}

async function listPackages(schema) {
    const query = `
        SELECT DISTINCT object_name AS package_name
        FROM all_objects
        WHERE owner = :schema
          AND object_type = 'PACKAGE'
        ORDER BY object_name
    `;
    const result = await database.simpleExecute(query, { schema: schema.toUpperCase() });
    return (result.rows || []).map(r => r.PACKAGE_NAME);
}

async function fetchOracleArguments(targetSchema, targetPackage) {
    const binds = { targetSchema: targetSchema.toUpperCase() };
    let pkgFilter = '';

    if (targetPackage) {
        if (targetPackage.includes('%')) {
            pkgFilter = ' AND UPPER(package_name) LIKE :targetPackage';
            binds.targetPackage = targetPackage.toUpperCase();
        } else {
            pkgFilter = ' AND UPPER(package_name) = :targetPackage';
            binds.targetPackage = targetPackage.toUpperCase();
        }
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

    console.log(`Consultando ALL_ARGUMENTS para esquema '${targetSchema}'${targetPackage ? ` y paquete '${targetPackage}'` : ''}...`);
    const result = await database.simpleExecute(query, binds);
    return result.rows || [];
}

function groupObjects(rows) {
    const objects = new Map();

    for (const row of rows) {
        const pkg = row.PACKAGE_NAME || null;
        const obj = row.OBJECT_NAME;
        const overload = row.OVERLOAD || '0';
        const key = `${pkg || '__STANDALONE__'}.${obj}.${overload}`;

        if (!objects.has(key)) {
            objects.set(key, {
                packageName: pkg,
                objectName: obj,
                overload,
                isFunction: false,
                returnType: null,
                arguments: []
            });
        }

        const entry = objects.get(key);

        if (row.POSITION === 0) {
            entry.isFunction = true;
            entry.returnType = row.DATA_TYPE;
        } else if (row.ARGUMENT_NAME) {
            entry.arguments.push({
                name: row.ARGUMENT_NAME,
                position: row.POSITION,
                dataType: row.DATA_TYPE,
                inOut: row.IN_OUT
            });
        }
    }

    return Array.from(objects.values());
}

function loadExistingSpMapper() {
    try {
        const spPath = path.resolve(__dirname, '..', 'config', 'spmapper.js');
        if (fs.existsSync(spPath)) {
            delete require.cache[require.resolve(spPath)];
            const mod = require(spPath);
            return mod.jsonStoreProcedure || {};
        }
    } catch (err) {
        console.warn('Nota: No se pudo cargar spmapper.js existente:', err.message);
    }
    return {};
}

function loadExistingFnMapper() {
    try {
        const fnPath = path.resolve(__dirname, '..', 'config', 'fnmapper.js');
        if (fs.existsSync(fnPath)) {
            delete require.cache[require.resolve(fnPath)];
            const mod = require(fnPath);
            return mod.jsonStoreFunction || {};
        }
    } catch (err) {
        console.warn('Nota: No se pudo cargar fnmapper.js existente:', err.message);
    }
    return {};
}

function indexExistingBySpName(existingSpMap) {
    const index = new Map();
    for (const [alias, def] of Object.entries(existingSpMap || {})) {
        if (def && def.sp_name) {
            const norm = def.sp_name.trim().toUpperCase();
            if (!index.has(norm)) {
                index.set(norm, []);
            }
            index.get(norm).push({ alias, def });
        }
    }
    return index;
}

function indexExistingByFnName(existingFnMap) {
    const index = new Map();
    for (const [alias, def] of Object.entries(existingFnMap || {})) {
        if (def && def.fn_name) {
            const norm = def.fn_name.trim().toUpperCase();
            if (!index.has(norm)) {
                index.set(norm, []);
            }
            index.get(norm).push({ alias, def });
        }
    }
    return index;
}

/**
 * Genera el JSON de Stored Procedures con doble alias (nuevo y legacy)
 * para garantizar retrocompatibilidad total con los frontends existentes.
 */
function generateSpMapper(procedures, existingSpMap = {}) {
    const spMap = {};
    const existingIndex = indexExistingBySpName(existingSpMap);

    for (const proc of procedures) {
        const fullName = proc.packageName ?
            `${proc.packageName}.${proc.objectName}` :
            proc.objectName;
        const normFullName = fullName.trim().toUpperCase();

        const baseAlias = generateSpAlias(proc.objectName, proc.packageName);
        const finalAlias = proc.overload && proc.overload !== '0' ?
            `${baseAlias}_v${proc.overload}` :
            baseAlias;

        const inParams = [];
        const outParams = [];

        for (const arg of proc.arguments) {
            const isOutVar = (arg.name || '').toUpperCase().includes('SALIDA') ||
                             (arg.name || '').toUpperCase().includes('ERROR') ||
                             (arg.name || '').toUpperCase().includes('MSG') ||
                             (arg.name || '').toUpperCase().includes('CURSOR');

            if (arg.inOut === 'IN' || (arg.inOut === 'IN/OUT' && !isOutVar)) {
                inParams.push(formatInParam(arg.name));
            }
            if (arg.inOut === 'OUT' || arg.inOut === 'IN/OUT') {
                outParams.push(formatOutParam(arg.name, arg.dataType));
            }
        }

        const entry = {
            sp_name: fullName
        };

        if (inParams.length > 0) {
            entry.in_param = inParams;
        }

        if (outParams.length > 0) {
            entry.out_param = outParams;
        }

        // Preservar propiedades especiales que pudieran existir (fileName, opt, log)
        const legacyEntries = existingIndex.get(normFullName) || [];
        for (const legacy of legacyEntries) {
            if (legacy.def.fileName) entry.fileName = legacy.def.fileName;
            if (legacy.def.log) entry.log = legacy.def.log;
            if (legacy.def.opt) entry.opt = legacy.def.opt;
        }

        // 1. Registrar el nuevo alias corto:
        spMap[finalAlias] = entry;

        // 2. Retrocompatibilidad: Conservar los nombres viejos si ya existían
        for (const legacy of legacyEntries) {
            if (legacy.alias !== finalAlias) {
                spMap[legacy.alias] = entry;
            }
        }
    }

    return spMap;
}

/**
 * Genera el JSON de Funciones con doble alias (nuevo y legacy).
 */
function generateFnMapper(functions, existingFnMap = {}) {
    const fnMap = {};
    const existingIndex = indexExistingByFnName(existingFnMap);

    for (const fn of functions) {
        const fullName = fn.packageName ?
            `${fn.packageName}.${fn.objectName}` :
            fn.objectName;
        const normFullName = fullName.trim().toUpperCase();

        const baseAlias = generateSpAlias(fn.objectName, fn.packageName);
        const finalAlias = fn.overload && fn.overload !== '0' ?
            `${baseAlias}_v${fn.overload}` :
            baseAlias;

        const inParams = {};

        for (const arg of fn.arguments) {
            if (arg.inOut === 'IN' || arg.inOut === 'IN/OUT') {
                const friendlyKey = toPascalCase(arg.name);
                inParams[friendlyKey] = arg.name;
            }
        }

        const entry = {
            fn_name: fullName,
            in_param: inParams,
            out_param: {
                varName: 'value'
            }
        };

        // 1. Registrar nuevo alias:
        fnMap[finalAlias] = entry;

        // 2. Retrocompatibilidad: Conservar nombres viejos si ya existían
        const legacyEntries = existingIndex.get(normFullName) || [];
        for (const legacy of legacyEntries) {
            if (legacy.alias !== finalAlias) {
                fnMap[legacy.alias] = entry;
            }
        }
    }

    return fnMap;
}

async function main() {
    try {
        const args = process.argv.slice(2);
        const targetSchema = (process.env.TARGET_SCHEMA || 'US_SUELDO').toUpperCase();

        await database.initialize();

        // Modo listar paquetes: node scripts/generate_mappers.js --list
        if (args.includes('--list') || args.includes('-l')) {
            console.log(`\nBuscando paquetes en el esquema '${targetSchema}'...`);
            const packages = await listPackages(targetSchema);
            console.log(`\nPaquetes encontrados (${packages.length}):`);
            packages.forEach(p => console.log(`  - ${p}`));
            console.log(`\nPara mapear uno específico ejecuta:`);
            console.log(`  node scripts/generate_mappers.js <NOMBRE_PAQUETE>\n`);
            return;
        }

        let targetPackage = null;
        if (args.length > 0 && !args[0].startsWith('--')) {
            targetPackage = args[0].toUpperCase();
        } else if (process.env.TARGET_PACKAGE || process.env.PACKAGE) {
            targetPackage = (process.env.TARGET_PACKAGE || process.env.PACKAGE).toUpperCase();
        }

        const overwrite = process.env.OVERWRITE === 'true';

        console.log(`--- Generador de Mappers ---`);
        console.log(`Esquema: ${targetSchema}`);
        if (targetPackage) {
            console.log(`Paquete seleccionado: ${targetPackage}`);
        } else {
            console.log(`Modo: Todos los paquetes`);
        }

        const rows = await fetchOracleArguments(targetSchema, targetPackage);
        console.log(`Argumentos obtenidos de Oracle: ${rows.length}`);

        if (rows.length === 0) {
            console.log('No se encontraron procedimientos o funciones.');
            return;
        }

        const objects = groupObjects(rows);
        const procedures = objects.filter(o => !o.isFunction);
        const functions = objects.filter(o => o.isFunction);

        console.log(`\nResultados:`);
        console.log(`  - Procedures encontrados: ${procedures.length}`);
        console.log(`  - Funciones encontradas: ${functions.length}`);

        const configDir = path.resolve(__dirname, '..', 'config');
        const existingSpMap = loadExistingSpMapper();
        const existingFnMap = loadExistingFnMapper();

        console.log(`  - Mappers existentes leídos para retrocompatibilidad: ${Object.keys(existingSpMap).length} SPs, ${Object.keys(existingFnMap).length} FNs`);

        // 1. Stored Procedures
        if (procedures.length > 0 || Object.keys(existingSpMap).length > 0) {
            const spMap = generateSpMapper(procedures, existingSpMap);

            // Si es modo global (--all), conservar también los SP existentes de otros paquetes
            if (!targetPackage) {
                for (const [key, val] of Object.entries(existingSpMap)) {
                    if (!spMap[key]) {
                        spMap[key] = val;
                    }
                }
            }

            const spJsonString = JSON.stringify(spMap, null, 4);

            if (targetPackage) {
                console.log(`\n======================================================`);
                console.log(`JSON para spmapper.js (Paquete: ${targetPackage}):`);
                console.log(`======================================================\n`);
                console.log(spJsonString);

                const outPath = path.join(configDir, `spmapper.${targetPackage}.json`);
                fs.writeFileSync(outPath, spJsonString, 'utf-8');
                console.log(`\nGuardado en: ${outPath}`);
            } else {
                const spFileName = overwrite ? 'spmapper.js' : 'spmapper.generated.js';
                const spPath = path.join(configDir, spFileName);
                const fileContent = `// Generado automáticamente por scripts/generate_mappers.js\n` +
                                    `module.exports.jsonStoreProcedure = ${spJsonString};\n`;
                fs.writeFileSync(spPath, fileContent, 'utf-8');
                console.log(`\nArchivo SP generado: ${spPath}`);
            }
        }

        // 2. Funciones
        if (functions.length > 0 || Object.keys(existingFnMap).length > 0) {
            const fnMap = generateFnMapper(functions, existingFnMap);

            if (!targetPackage) {
                for (const [key, val] of Object.entries(existingFnMap)) {
                    if (!fnMap[key]) {
                        fnMap[key] = val;
                    }
                }
            }

            const fnJsonString = JSON.stringify(fnMap, null, 4);

            if (targetPackage) {
                console.log(`\n======================================================`);
                console.log(`JSON para fnmapper.js (Paquete: ${targetPackage}):`);
                console.log(`======================================================\n`);
                console.log(fnJsonString);

                const outPath = path.join(configDir, `fnmapper.${targetPackage}.json`);
                fs.writeFileSync(outPath, fnJsonString, 'utf-8');
                console.log(`\nGuardado en: ${outPath}`);
            } else {
                const fnFileName = overwrite ? 'fnmapper.js' : 'fnmapper.generated.js';
                const fnPath = path.join(configDir, fnFileName);
                const fileContent = `// Generado automáticamente por scripts/generate_mappers.js\n` +
                                    `module.exports.jsonStoreFunction = ${fnJsonString};\n`;
                fs.writeFileSync(fnPath, fileContent, 'utf-8');
                console.log(`\nArchivo FN generado: ${fnPath}`);
            }
        }

    } catch (error) {
        console.error('Error durante la generación de mappers:', error.message);
        process.exitCode = 1;
    } finally {
        try {
            await database.close();
        } catch (_) {}
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    groupObjects,
    generateSpMapper,
    generateFnMapper,
    generateSpAlias,
    formatInParam,
    formatOutParam,
    loadExistingSpMapper,
    loadExistingFnMapper,
    indexExistingBySpName,
    indexExistingByFnName,
    toCamelCase,
    toPascalCase
};

