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
            const val = findContextValue(element);
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
