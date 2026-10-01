const database = require('../services/database');
const oracledb = require('oracledb');

function getSQLcall(sp) {
    let sqlCab = 'BEGIN ' + sp.sp_name;
    let first = true;

    if (sp['in_param']) {
        sp.in_param.forEach(element => {
            if (first) {
                sqlCab += '(';
                first = false;
            } else {
                sqlCab += ', ';
            }
            sqlCab += ':' + element;
        });
    } else {
        sqlCab += '(';
        first = true;
    }

    if (sp['out_param']) {
        sp.out_param.forEach(element => {
            if (first) {
                sqlCab += ' :' + element;
                first = false;
            } else {
                sqlCab += ', :' + element;
            }
        });
    }

    sqlCab += '); END;';

    return sqlCab;
}

function getSQLbinds(context, sp) {
    const binds = context;

    for (const key in context) {
        binds[key] = context[key];
    }

    if (sp['out_param']) {
        sp.out_param.forEach(element => {
            if (element != 'Cursor') {
                binds[element] = { dir: oracledb.BIND_OUT };
            } else {
                binds[element] = { type: oracledb.CURSOR, dir: oracledb.BIND_OUT };
            }
        });
    }

    return binds;
}

async function execStoreProcedure(context, sp) {
    let query = getSQLcall(sp);
    let binds = getSQLbinds(context, sp);

    let result = {};
    let json = {};

    const syncro = sp['opt'] ? sp.opt['sync'] : true;

    const start = Date.now();

    if (syncro) {
        result = await database.simpleExecute(query, binds);
    } else {
        result = database.simpleExecute(query, binds);
    }

    const millis = Date.now() - start;

    json = { status: 200, params: binds, out: result.outBinds, elapsed: Math.floor(millis / 1000) };

    return json;
}

module.exports.getSQLcall = getSQLcall;
module.exports.getSQLbinds = getSQLbinds;
module.exports.execStoreProcedure = execStoreProcedure;
