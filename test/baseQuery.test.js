const assert = require('node:assert/strict');
const test = require('node:test');

const baseQuery = require('../db_apis/baseQuery');

const fields = {
    Nombre: 'PERSONAS.NOMBRE',
    Fecha: 'PERSONAS.FECHA'
};

test('mantiene una consulta sin filtros sin binds extra', () => {
    const result = baseQuery.getWhereFields({}, fields);

    assert.equal(result.where, '');
    assert.deepEqual(result.binds, {});
});

test('usa binds para filtros directos y búsqueda', () => {
    const direct = baseQuery.getWhereFields({ Nombre: 'JUAN' }, fields);
    const search = baseQuery.getWhereFields({ search: 'Nombre:JUAN' }, fields);

    assert.match(direct.where, /PERSONAS\.NOMBRE = :Nombre/);
    assert.equal(direct.binds.Nombre, 'JUAN');
    assert.match(search.where, /lower\(PERSONAS\.NOMBRE\) like :searchText/);
    assert.equal(search.binds.searchText, '%juan%');
});

test('usa binds para rangos de fechas', () => {
    const result = baseQuery.getWhereFields({
        greatereq: 'Fecha:01/01/2026',
        lesseq: 'Fecha:31/01/2026'
    }, fields);

    assert.match(result.where, /PERSONAS\.FECHA >= to_date\(:greatereqValue/);
    assert.match(result.where, /PERSONAS\.FECHA <= to_date\(:lesseqValue/);
    assert.equal(result.binds.greatereqValue, '01/01/2026');
    assert.equal(result.binds.lesseqValue, '31/01/2026');
});

test('valida ordenamiento y paginación', () => {
    const result = baseQuery.getWhereFields({
        limit: '10',
        sort: '{"Nombre":"desc"}'
    }, fields);

    assert.equal(result.binds.limit, 10);
    assert.equal(result.binds.offset, 0);
    assert.match(result.where, /order by PERSONAS\.NOMBRE desc/);
});

test('rechaza campos que no están en el mapper', () => {
    assert.throws(
        () => baseQuery.getWhereFields({ search: 'Password:secret' }, fields),
        error => error.statusCode === 400
    );
});

test('rechaza paginación y ordenamiento inválidos', () => {
    assert.throws(
        () => baseQuery.getWhereFields({ limit: '1001' }, fields),
        error => error.statusCode === 400
    );
    assert.throws(
        () => baseQuery.getWhereFields({ sort: '{"Nombre":"drop"}' }, fields),
        error => error.statusCode === 400
    );
});

test('parseSelectedFields resuelve campos y deduplica', () => {
    assert.equal(baseQuery.parseSelectedFields({}, fields), null);
    assert.equal(baseQuery.parseSelectedFields({ fields: '' }, fields), null);

    const exact = baseQuery.parseSelectedFields({ fields: 'Nombre, Fecha' }, fields);
    assert.deepEqual(exact, ['Nombre', 'Fecha']);

    const caseInsensitive = baseQuery.parseSelectedFields({ fields: 'nombre,fecha' }, fields);
    assert.deepEqual(caseInsensitive, ['Nombre', 'Fecha']);

    const dedup = baseQuery.parseSelectedFields({ fields: 'Nombre, nombre, Fecha' }, fields);
    assert.deepEqual(dedup, ['Nombre', 'Fecha']);

    const withColumns = baseQuery.parseSelectedFields({ columns: 'Nombre' }, fields);
    assert.deepEqual(withColumns, ['Nombre']);
});

test('parseSelectedFields rechaza campos desconocidos con 400', () => {
    assert.throws(
        () => baseQuery.parseSelectedFields({ fields: 'Nombre, CampoInexistente' }, fields),
        error => error.statusCode === 400 && error.message.includes('CampoInexistente')
    );
});

test('getWhereFields ignora fields y columns sin agregarlos al WHERE', () => {
    const result = baseQuery.getWhereFields({
        Nombre: 'JUAN',
        fields: 'Nombre,Fecha',
        columns: 'Nombre'
    }, fields);

    assert.match(result.where, /PERSONAS\.NOMBRE = :Nombre/);
    assert.equal(result.binds.Nombre, 'JUAN');
    assert.equal(result.binds.fields, undefined);
    assert.equal(result.binds.columns, undefined);
    assert.doesNotMatch(result.where, /fields/);
});

test('getSQLselect proyecta solo columnas solicitadas', () => {
    const entity = {
        table: 'PERSONAS',
        fields: {
            Id: 'PERSONAS.ID',
            Nombre: 'PERSONAS.NOMBRE',
            Email: 'PERSONAS.EMAIL'
        }
    };

    const sqlAll = baseQuery.getSQLselect(entity);
    assert.match(sqlAll, /PERSONAS\.ID as Id/);
    assert.match(sqlAll, /PERSONAS\.NOMBRE as Nombre/);
    assert.match(sqlAll, /PERSONAS\.EMAIL as Email/);

    const sqlSubset = baseQuery.getSQLselect(entity, ['Id', 'Email']);
    assert.match(sqlSubset, /PERSONAS\.ID as Id/);
    assert.match(sqlSubset, /PERSONAS\.EMAIL as Email/);
    assert.doesNotMatch(sqlSubset, /PERSONAS\.NOMBRE as Nombre/);
});

const viewapi = require('../db_apis/view');

test('viewapi.getSQLselect proyecta solo columnas solicitadas', () => {
    const viewEntity = {
        fields: {
            IdConf: 'c.idconf',
            Descripcion: 'c.descripcion',
            Ambiente: 'c.ambiente'
        },
        sql: {
            fromClause: ['from config_server c']
        }
    };

    const sqlSubset = viewapi.getSQLselect(viewEntity, ['IdConf', 'Ambiente']);
    assert.match(sqlSubset, /c\.idconf as IdConf/);
    assert.match(sqlSubset, /c\.ambiente as Ambiente/);
    assert.doesNotMatch(sqlSubset, /c\.descripcion as Descripcion/);
});