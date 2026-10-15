const database = require('../services/database');
const oracledb = require('oracledb');

function getSQLcall(sp) {
    const spName = (sp && sp.sp_name ? sp.sp_name : '').trim();
    const params = [];

    if (sp && sp.in_param && Array.isArray(sp.in_param)) {
        sp.in_param.forEach(element => {
            params.push(':' + element);
        });
    }

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
    if (val instanceof Date) {
        return val;
    }

    if (typeof val === 'boolean') {
        return val ? 1 : 0;
    }

    const lower = String(paramName || '').toLowerCase();
    const isDateField = lower.includes('periodo') || lower.includes('fecha') || lower.includes('fec');

    if (typeof val === 'string') {
        const trimmed = val.trim();

        // 1. Fecha ISO YYYY-MM-DD
        const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
            const year = parseInt(isoMatch[1], 10);
            const month = parseInt(isoMatch[2], 10) - 1;
            const day = parseInt(isoMatch[3], 10);
            const d = new Date(Date.UTC(year, month, day));
            if (!isNaN(d.getTime())) return d;
        }

        // 2. Fecha DD/MM/YYYY o D/M/YYYY
        const dmyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dmyMatch) {
            const day = parseInt(dmyMatch[1], 10);
            const month = parseInt(dmyMatch[2], 10) - 1;
            const year = parseInt(dmyMatch[3], 10);
            const d = new Date(Date.UTC(year, month, day));
            if (!isNaN(d.getTime())) return d;
        }

        // 3. Periodo YYYY-MM
        if (isDateField && /^\d{4}-\d{2}$/.test(trimmed)) {
            const parts = trimmed.split('-');
            const d = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1));
            if (!isNaN(d.getTime())) return d;
        }

        // 4. Periodo MM/YYYY
        const myMatch = trimmed.match(/^(\d{1,2})\/(\d{4})$/);
        if (isDateField && myMatch) {
            const month = parseInt(myMatch[1], 10) - 1;
            const year = parseInt(myMatch[2], 10);
            const d = new Date(Date.UTC(year, month, 1));
            if (!isNaN(d.getTime())) return d;
        }

        // 5. Numéricos para parámetros que indican ID, tipo, grupo, ley, cuota, nro, valor, cant, lote
        const isNumericParam = lower.includes('id') || lower.includes('tipo') || lower.includes('grupo') || 
                               lower.includes('ley') || lower.includes('cuota') || lower.includes('nro') || 
                               lower.includes('valor') || lower.includes('cant') || lower.includes('lote');
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
            if (normK.length >= 4 && normParam.length >= 4) {
                if (normParam.startsWith(normK) || normK.startsWith(normParam)) {
                    return ctx[k];
                }
            }
        }

        return undefined;
    }

    if (sp && sp.in_param && Array.isArray(sp.in_param)) {
        sp.in_param.forEach(element => {
            const rawVal = findContextValue(element);
            const val = coerceValueForBind(rawVal, element);
            binds[element] = (val !== undefined && val !== '') ? val : null;
        });
    }

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

    return {
        status: 200,
        call: query,
        params: binds,
        out: result.outBinds,
        elapsed: Math.floor(millis / 1000)
    };
}

module.exports.getSQLcall = getSQLcall;
module.exports.getSQLbinds = getSQLbinds;
module.exports.execStoreProcedure = execStoreProcedure;
