const database = require('../services/database');
const baseQuery = require('./baseQuery');

function getSQLselect(entity, selectedKeys) {
    let sqlCab = 'SELECT ';
    let first = true;
    const keys = (selectedKeys && selectedKeys.length > 0) ? selectedKeys : Object.keys(entity.fields);
    for (const key of keys) {
        if (first) {
            first = false;
        } else {
            sqlCab += ', ';
        }
        sqlCab += entity.fields[key] + ' as ' + key;
    }
    entity.sql["fromClause"].forEach(line => {
        sqlCab += '\n' + line + ' ';
    });

    return sqlCab;
}

async function getRepo(context, entity) {
    const selectedKeys = baseQuery.parseSelectedFields(context, entity.fields);
    let query = getSQLselect(entity, selectedKeys);

    let queryWhere = baseQuery.getWhereFields(context, entity.whereFields);

    let sqlGroup = '';

    if (entity.sql["groupClause"]) {
        entity.sql["groupClause"].forEach(line => {
            sqlGroup += '\n' + line + ' ';
        });
    }

    let fullQuery = query + queryWhere.where + sqlGroup;

    const result = await database.simpleExecute(fullQuery, queryWhere.binds);

    return result;
}

module.exports.getRepo = getRepo;
module.exports.getSQLselect = getSQLselect;
