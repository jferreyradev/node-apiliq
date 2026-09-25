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