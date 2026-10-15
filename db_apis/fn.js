const database = require('../services/database');
const oracledb = require('oracledb');

function getSQLcall(fn) {
    let sqlCab = 'BEGIN  :' + fn.out_param.varName + ' := ' + fn.fn_name + '(';
    let first = true;
    for (const key in fn.in_param) {
        if (first) {
            first = false;
        } else {
            sqlCab += ', ';
        }
        sqlCab += ':' + key;
    }

    sqlCab += ');';
    sqlCab += ' END;';

    return sqlCab;
}

async function execFn(context, fn) {
    let query = getSQLcall(fn);

    const binds = context;

    for (const key in context) {
        binds[key] = context[key];
    }

    binds[fn.out_param.varName] = { dir: oracledb.BIND_OUT, type: oracledb.NUMBER };

    let result;
    try {
        result = await database.simpleExecute(query, binds);
    } catch (err) {
        err.call = query;
        err.statement = query;
        err.params = binds;
        err.fn = fn && fn.fn_name ? fn.fn_name.trim() : undefined;
        throw err;
    }

    return result.outBinds;
}

module.exports.execFn = execFn;
