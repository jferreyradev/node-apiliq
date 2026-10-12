const { query } = require('express');
const { SHUTDOWN_MODE_IMMEDIATE } = require('oracledb');
const database = require('../services/database');

//private func

function getSQLcomplexSelect(entity, parentEntity, selectedKeys) {
    let sqlCab = 'SELECT ';
    let first = true;
    const keys = (selectedKeys && selectedKeys.length > 0) ? selectedKeys : Object.keys(entity.fields);
    for (const key of keys) {
        if (first) {
            first = false;
        } else {
            sqlCab += ', ';
        }
        if (typeof entity.fields[key] != 'object') {
            sqlCab += entity.fields[key] + ' as ' + key;
        } else {
            sqlCab += '(' + getSQLcomplexSelect(entity.fields[key], entity) + ') as ' + key;
        }
    }
    sqlCab += '\nFROM ' + entity.table;

    if (parentEntity != undefined) {
        sqlCab += `\nwhere ` + entity.table + '.' + entity.foringKey + `= ` + parentEntity.table + '.' + entity.parentKey;
    }

    return sqlCab;
}

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
    sqlCab += '\nFROM ' + entity.table;

    return sqlCab;
}

function getSQLinsert(context, entity) {
    let sqlCab = 'INSERT INTO ' + entity.table;
    let strValues = '';
    let first = true;
    let hasSeq = false;

    for (const key in entity.fields) {
        if (typeof entity.fields[key] != 'object' && key in context) {
            // || (entity['sequence'] && key == entity['sequence'].field))) {
            if (first) {
                first = false;
                sqlCab += ' (';
                strValues = ' VALUES ('
            } else {
                sqlCab += ', ';
                strValues += ', ';
            }
            //if (typeof entity.fields[key] != 'object') {
            sqlCab += entity.fields[key];
            //}

            if (entity['key'].field == key) {
                if (entity['key'].seq) {
                    strValues += entity.key.seq;
                } else {
                    strValues += ':' + key;
                }
            } else {
                strValues += ':' + key;
            }
        }
    }

    strValues += ')';
    sqlCab += ') ' + strValues;

    return sqlCab;
}

function getSQLupdate(context, entity) {
    let sqlCab = 'UPDATE ' + entity.table;
    let first = true;

    //console.log(context);

    for (const key in entity.fields) {
        if ((typeof entity.fields[key] != 'object') && (key in context && (key != entity['key'].field))) {
            if (first) {
                first = false;
                sqlCab += ' SET ';
            } else {
                sqlCab += ', ';
            }
            if (typeof entity.fields[key] != 'object') {
                sqlCab += entity.fields[key] + '= :' + key;
            }
        }
    }

    sqlCab += ' WHERE ' + entity.fields[entity['key'].field] + '= :' + entity['key'].field;

    return sqlCab;
}

function getSQLdelete(context, entity) {
    let sqlCab = 'DELETE ' + entity.table;

    sqlCab += ' WHERE ' + entity.fields[entity['key'].field] + '= :' + entity['key'].field;

    return sqlCab;
}


// public func

async function modify(context, entity) {
    let query = getSQLupdate(context, entity);
    const binds = {};

    for (const key in context) {
        if (typeof entity.fields[key] != 'object') {
            binds[key] = context[key];
        }
    }

    //console.log(query);
    //console.log(binds);

    if (binds[entity["key"].field]) {
        let result = await database.simpleExecute(query, binds);
        let json = { 'result': result, 'status': 200, rows: [] };
        return json;
    } else {
        let json = { 'err': 'Key field is not defined', 'status': 400 };
        return json;
    }

}

async function remove(context, entity) {
    let query = getSQLdelete(context, entity);
    const binds = {};

    //console.log(query);
    //console.log(binds);

    if (entity["key"].del) {

        for (const key in context) {
            if (typeof entity.fields[key] != 'object') {
                binds[key] = context[key];
            }
        }

        if (binds[entity["key"].field]) {
            console.log(query);
            let result = await database.simpleExecute(query, binds);
            let json = { 'result': result, 'status': 200, rows: [] };
            return json;
        } else {
            let json = { 'err': 'Key field is not defined', 'status': 400 };
            return json;
        }
    } else {

        let json = { 'err': 'delete is not permited', 'status': 400 };
        return json;

    }

}

async function create(context, entity) {
    let query = getSQLinsert(context, entity);
    const binds = {};

    //console.log(query);

    let eseq;

    for (const key in context) {
        if (typeof entity.fields[key] != 'object') {

            eseq = entity['key'].seq?true:false;

            //console.log(eseq)

            if (key != entity['key'].field || (key == entity['key'].field  && entity['key'].insert == true) ){
                binds[key] = context[key];
            }

        }
    }

    //console.log(query);
    //console.log(binds);

    let result = await database.simpleExecute(query, binds);
    let json = { 'result': result, 'status': 200, rows: [] };
    return json;
    //return result;
}

function badRequest(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
}

function getMappedField(fields, key) {
    if (!Object.prototype.hasOwnProperty.call(fields, key) || typeof fields[key] !== 'string') {
        throw badRequest(`Campo no permitido: ${key}`);
    }

    return fields[key];
}

function parseFilter(value, name) {
    const separator = value.indexOf(':');
    if (separator <= 0 || separator === value.length - 1) {
        throw badRequest(`${name} debe tener formato campo:valor`);
    }

    return [value.slice(0, separator), value.slice(separator + 1)];
}

function parsePagination(value, name, defaultValue) {
    if (value === undefined) {
        return defaultValue;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1000) {
        throw badRequest(`${name} debe ser un entero entre 0 y 1000`);
    }

    return parsed;
}

function addClause(clauses, clause) {
    clauses.push(clause);
}

function getValidatedWhere(context, fields) {
    const binds = {};
    const clauses = [];

    if (context.limit !== undefined) {
        binds.limit = parsePagination(context.limit, 'limit', 0);
        binds.offset = parsePagination(context.offset, 'offset', 0);
    }

    for (const key of Object.keys(context)) {
        if (['limit', 'offset', 'sort', 'search', 'greatereq', 'lesseq', 'fields', 'columns'].includes(key)) {
            continue;
        }

        const field = getMappedField(fields, key);
        if (context[key] === 'null') {
            addClause(clauses, `${field} is null`);
        } else {
            addClause(clauses, `${field} = :${key}`);
            binds[key] = context[key];
        }
    }

    if (context.search !== undefined) {
        const [key, text] = parseFilter(context.search, 'search');
        const field = getMappedField(fields, key);
        addClause(clauses, `lower(${field}) like :searchText`);
        binds.searchText = `%${text.toLowerCase()}%`;
    }

    for (const [name, operator] of [['greatereq', '>='], ['lesseq', '<=']]) {
        if (context[name] === undefined) {
            continue;
        }

        const [key, value] = parseFilter(context[name], name);
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
            throw badRequest(`${name} debe usar formato dd/mm/yyyy`);
        }

        const field = getMappedField(fields, key);
        const bindName = `${name}Value`;
        addClause(clauses, `${field} ${operator} to_date(:${bindName}, 'dd/mm/yyyy')`);
        binds[bindName] = value;
    }

    let order = '';
    if (context.sort !== undefined) {
        let jsonSort;
        try {
            jsonSort = JSON.parse(context.sort);
        } catch (error) {
            throw badRequest('sort debe ser un JSON válido');
        }

        const orderParts = Object.entries(jsonSort).map(([key, direction]) => {
            const field = getMappedField(fields, key);
            const normalizedDirection = String(direction).toLowerCase();
            if (!['asc', 'desc'].includes(normalizedDirection)) {
                throw badRequest('La dirección de sort debe ser asc o desc');
            }

            return `${field} ${normalizedDirection}`;
        });

        if (orderParts.length === 0) {
            throw badRequest('sort no puede estar vacío');
        }

        order = `\norder by ${orderParts.join(', ')}`;
    }

    return {
        where: clauses.length ? `\nwhere ${clauses.join('\nand ')}` : '',
        binds,
        order
    };
}

function parseSelectedFields(context, fields) {
    if (!context || !fields) {
        return null;
    }

    const raw = context.fields !== undefined ? context.fields : context.columns;
    if (raw === undefined || raw === null) {
        return null;
    }

    if (typeof raw !== 'string' && !Array.isArray(raw)) {
        throw badRequest('El parámetro fields/columns debe ser una lista separada por comas');
    }

    const items = (Array.isArray(raw) ? raw.join(',') : String(raw))
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

    if (items.length === 0) {
        return null;
    }

    const fieldKeys = Object.keys(fields);
    const resolvedKeys = [];

    for (const item of items) {
        let matchedKey = null;
        if (Object.prototype.hasOwnProperty.call(fields, item)) {
            matchedKey = item;
        } else {
            matchedKey = fieldKeys.find(k => k.toLowerCase() === item.toLowerCase());
        }

        if (!matchedKey) {
            throw badRequest(`Campo no permitido en selección: ${item}`);
        }

        if (!resolvedKeys.includes(matchedKey)) {
            resolvedKeys.push(matchedKey);
        }
    }

    return resolvedKeys;
}

function getWhere(context, entity) {
    const result = getValidatedWhere(context, entity.fields);
    return {
        where: result.where + result.order,
        binds: result.binds
    };
}

function getWhereFields(context, fields) {
    const result = getValidatedWhere(context, fields);
    return {
        where: result.where + result.order,
        binds: result.binds
    };
}

async function find(context, entity) {
    const selectedKeys = parseSelectedFields(context, entity.fields);
    let query = getSQLcomplexSelect(entity, undefined, selectedKeys);

    let queryWhere = getWhere(context, entity);

    let fullQuery = query + queryWhere.where;

    //console.log(fullQuery, queryWhere.binds);

    const result = await database.simpleExecute(fullQuery, queryWhere.binds);

    return result;
}

module.exports.find = find;
module.exports.create = create;
module.exports.modify = modify;
module.exports.remove = remove;
module.exports.getWhere = getWhere;
module.exports.getWhereFields = getWhereFields;
module.exports.parseSelectedFields = parseSelectedFields;
module.exports.getSQLselect = getSQLselect;
module.exports.getSQLcomplexSelect = getSQLcomplexSelect;