const database = require('../services/database');
const oracledb = require('oracledb');

function getEffectiveInParams(sp) {
    if (!sp || !Array.isArray(sp.in_param)) return [];
    const outParams = Array.isArray(sp.out_param) ? sp.out_param : [];
    if (outParams.length === 0) return sp.in_param;

    const outNorms = new Set(outParams.map(o => {
        const u = String(o).toUpperCase();
        if (u === 'VALORSALIDA') return 'SALIDA';
        if (u === 'VALORERROR') return 'ERROR';
        return normalizeParamName(o).toUpperCase();
    }));

    return sp.in_param.filter(inP => {
        const normIn = normalizeParamName(inP).toUpperCase();
        return !outNorms.has(normIn);
    });
}

function getSQLcall(sp) {
    const spName = (sp && sp.sp_name ? sp.sp_name : '').trim();
    const params = [];

    const inParams = getEffectiveInParams(sp);
    inParams.forEach(element => {
        params.push(':' + element);
    });

    if (sp && sp.out_param && Array.isArray(sp.out_param)) {
        sp.out_param.forEach(element => {
            params.push(':' + element);
        });
    }

    return `BEGIN ${spName}(${params.join(', ')}); END;`;
}

function normalizeParamName(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .replace(/^v_?id_?/, '')
        .replace(/^v_?/, '')
        .replace(/_?id$/, '')
        .replace(/[^a-z0-9]/g, '');
}

function coerceValueForBind(val, paramName) {
    if (val === undefined || val === null || val === '') {
        return null;
    }

    const lower = String(paramName || '').toLowerCase();
    const isPeriodoField = lower.includes('periodo') || lower === 'vper' || lower === 'per';
    const isDateField = isPeriodoField || lower.includes('fecha') || lower.includes('fec') || lower.includes('vto');

    if (val instanceof Date) {
        let year = val.getFullYear();
        let month = val.getMonth();
        let day = val.getDate();
        if (
            val.getUTCHours() === 0 &&
            val.getUTCMinutes() === 0 &&
            val.getUTCSeconds() === 0 &&
            val.getHours() !== 0
        ) {
            year = val.getUTCFullYear();
            month = val.getUTCMonth();
            day = val.getUTCDate();
        }
        if (isPeriodoField) {
            return new Date(year, month, 1, 0, 0, 0);
        }
        return new Date(year, month, day, 0, 0, 0);
    }

    if (typeof val === 'boolean') {
        return val ? 1 : 0;
    }

    if (typeof val === 'string') {
        const trimmed = val.trim();

        // 1. Fecha ISO YYYY-MM-DD (sin hora -> medianoche local; si es periodo, día siempre 01)
        const isoDateOnly = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (isoDateOnly) {
            const year = parseInt(isoDateOnly[1], 10);
            const month = parseInt(isoDateOnly[2], 10) - 1;
            const day = isPeriodoField ? 1 : parseInt(isoDateOnly[3], 10);
            const d = new Date(year, month, day, 0, 0, 0);
            if (!isNaN(d.getTime())) return d;
        }

        // 1b. Fecha ISO con hora YYYY-MM-DDTHH:mm...
        if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
            const d = new Date(trimmed);
            if (!isNaN(d.getTime())) {
                let year = d.getFullYear();
                let month = d.getMonth();
                let day = d.getDate();
                if (
                    d.getUTCHours() === 0 &&
                    d.getUTCMinutes() === 0 &&
                    d.getUTCSeconds() === 0 &&
                    d.getHours() !== 0
                ) {
                    year = d.getUTCFullYear();
                    month = d.getUTCMonth();
                    day = d.getUTCDate();
                }
                if (isPeriodoField) {
                    return new Date(year, month, 1, 0, 0, 0);
                }
                return new Date(year, month, day, 0, 0, 0);
            }
        }

        // 2. Fecha DD/MM/YYYY o D/M/YYYY (si es periodo, día siempre 01)
        const dmyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dmyMatch) {
            const day = isPeriodoField ? 1 : parseInt(dmyMatch[1], 10);
            const month = parseInt(dmyMatch[2], 10) - 1;
            const year = parseInt(dmyMatch[3], 10);
            const d = new Date(year, month, day, 0, 0, 0);
            if (!isNaN(d.getTime())) return d;
        }

        // 3. Periodo YYYY-MM -> Día 01 fijo
        const ymMatch = trimmed.match(/^(\d{4})-(\d{1,2})$/);
        if (isDateField && ymMatch) {
            const year = parseInt(ymMatch[1], 10);
            const month = parseInt(ymMatch[2], 10) - 1;
            const d = new Date(year, month, 1, 0, 0, 0);
            if (!isNaN(d.getTime())) return d;
        }

        // 4. Periodo MM/YYYY o M/YYYY -> Día 01 fijo
        const myMatch = trimmed.match(/^(\d{1,2})\/(\d{4})$/);
        if (isDateField && myMatch) {
            const month = parseInt(myMatch[1], 10) - 1;
            const year = parseInt(myMatch[2], 10);
            const d = new Date(year, month, 1, 0, 0, 0);
            if (!isNaN(d.getTime())) return d;
        }

        // 4b. Periodo compacto YYYYMM (ej: 202609) o MMYYYY (ej: 092026) -> Día 01 fijo
        if (isPeriodoField && /^\d{6}$/.test(trimmed)) {
            const firstFour = parseInt(trimmed.slice(0, 4), 10);
            const lastTwo = parseInt(trimmed.slice(4, 6), 10);
            if (firstFour >= 1990 && firstFour <= 2100 && lastTwo >= 1 && lastTwo <= 12) {
                return new Date(firstFour, lastTwo - 1, 1, 0, 0, 0);
            }
            const firstTwo = parseInt(trimmed.slice(0, 2), 10);
            const lastFour = parseInt(trimmed.slice(2, 6), 10);
            if (lastFour >= 1990 && lastFour <= 2100 && firstTwo >= 1 && firstTwo <= 12) {
                return new Date(lastFour, firstTwo - 1, 1, 0, 0, 0);
            }
        }

        // 5. Numéricos para parámetros que indican ID, tipo, grupo, ley, cuota, nro, valor, cant, lote, rep, ord, cod
        const isNumericParam = !isDateField && (
            lower.includes('id') || lower.includes('tipo') || lower.includes('grupo') || 
            lower.includes('ley') || lower.includes('cuota') || lower.includes('nro') || 
            lower.includes('valor') || lower.includes('cant') || lower.includes('lote') ||
            lower.includes('rep') || lower.includes('ord') || lower.includes('cod') ||
            lower.includes('cat') || lower.includes('imp')
        );
        if (isNumericParam && /^-?\d+(\.\d+)?$/.test(trimmed)) {
            return Number(trimmed);
        }
    }

    return val;
}

function getSQLbinds(context, sp) {
    const binds = {};
    const ctx = context || {};

    function findContextValue(paramName) {
        if (ctx[paramName] !== undefined) return ctx[paramName];

        const lowerName = paramName.toLowerCase();
        for (const k of Object.keys(ctx)) {
            if (k.toLowerCase() === lowerName) {
                return ctx[k];
            }
        }

        const normParam = normalizeParamName(paramName);
        for (const k of Object.keys(ctx)) {
            const normK = normalizeParamName(k);
            if (normK === normParam) {
                return ctx[k];
            }
            if (normK.length >= 3 && normParam.length >= 3) {
                if (normParam.startsWith(normK) || normK.startsWith(normParam)) {
                    return ctx[k];
                }
            }
        }

        return undefined;
    }

    const inParams = getEffectiveInParams(sp);
    inParams.forEach(element => {
        const rawVal = findContextValue(element);
        const val = coerceValueForBind(rawVal, element);
        binds[element] = (val !== undefined && val !== '') ? val : null;
    });

    if (sp && sp.out_param && Array.isArray(sp.out_param)) {
        sp.out_param.forEach(element => {
            if (element !== 'Cursor') {
                binds[element] = { dir: oracledb.BIND_OUT };
            } else {
                binds[element] = { type: oracledb.CURSOR, dir: oracledb.BIND_OUT };
            }
        });
    }

    return binds;
}

function detectSpError(outBinds) {
    if (!outBinds || typeof outBinds !== 'object') return null;

    let errorCode = null;
    let errorMessage = null;

    for (const [k, v] of Object.entries(outBinds)) {
        const lower = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        // Detectar código de error (valorerror, verror, error, etc.)
        if (
            lower === 'valorerror' ||
            lower === 'verror' ||
            lower === 'pvalorerror' ||
            lower === 'perror' ||
            lower === 'error' ||
            lower === 'errorcode' ||
            lower === 'coderror' ||
            (lower.includes('error') && !lower.includes('msg') && !lower.includes('mensaje'))
        ) {
            const num = Number(v);
            if (!isNaN(num) && num !== 0) {
                errorCode = num;
            } else if (typeof v === 'string' && v.trim() !== '' && v.trim() !== '0') {
                errorCode = v.trim();
            }
        }
        // Detectar mensaje de error
        if (
            lower.includes('msg') ||
            lower.includes('mensaje') ||
            lower.includes('desc')
        ) {
            if (typeof v === 'string' && v.trim() !== '') {
                errorMessage = v.trim();
            }
        }
    }

    if (errorCode !== null || errorMessage !== null) {
        return {
            code: errorCode,
            message: errorMessage || 'Error en la ejecución del procedimiento'
        };
    }
    return null;
}

async function execStoreProcedure(context, sp) {
    const query = getSQLcall(sp);
    const binds = getSQLbinds(context, sp);

    let result = {};
    const start = Date.now();

    try {
        result = await database.simpleExecute(query, binds);
    } catch (err) {
        err.call = query;
        err.statement = query;
        err.params = binds;
        err.sp = sp && sp.sp_name ? sp.sp_name.trim() : undefined;
        throw err;
    }

    const millis = Date.now() - start;
    const spError = detectSpError(result.outBinds);
    let httpStatus = 200;
    if (spError) {
        httpStatus = (typeof spError.code === 'number' && spError.code < 0) ? 500 : 400;
    }

    const response = {
        status: httpStatus,
        call: query,
        params: binds,
        out: result.outBinds,
        elapsed: Math.floor(millis / 1000)
    };

    if (spError) {
        response.error = spError.message;
        response.errorCode = spError.code;
    }

    return response;
}

module.exports.getSQLcall = getSQLcall;
module.exports.getSQLbinds = getSQLbinds;
module.exports.execStoreProcedure = execStoreProcedure;
module.exports.detectSpError = detectSpError;
