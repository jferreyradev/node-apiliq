const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSqlToViewConfig, buildConfigFromOracleColumns, splitTopLevelCommas } = require('../services/sqlViewParser');

test('sqlViewParser convierte consultas SELECT en configuraciones para API_VIEW_MAPPER', async (t) => {

    await t.test('splitTopLevelCommas respeta paréntesis y comillas', () => {
        const str = "p.id, p.apellido || ', ' || p.nombre AS ApeNom, fn(1, 2) AS Calculado";
        const parts = splitTopLevelCommas(str);
        assert.equal(parts.length, 3);
        assert.equal(parts[0], 'p.id');
        assert.equal(parts[1], "p.apellido || ', ' || p.nombre AS ApeNom");
        assert.equal(parts[2], 'fn(1, 2) AS Calculado');
    });

    await t.test('parseSqlToViewConfig procesa consulta completa con WHERE y ORDER BY', () => {
        const sql = `
            SELECT 
                p.idpers AS PersonaId,
                p.dni AS Documento,
                p.apellido || ', ' || p.nombre AS ApeNom,
                c.idrep AS IdRep
            FROM personas p
            INNER JOIN cargos c ON c.idpers = p.idpers
            WHERE c.idrep = :IdRep AND p.dni = :Documento
            ORDER BY p.apellido, p.nombre
        `;

        const config = parseSqlToViewConfig(sql);

        assert.ok(config.fields);
        assert.equal(config.fields.PersonaId, 'p.idpers');
        assert.equal(config.fields.Documento, 'p.dni');
        assert.equal(config.fields.ApeNom, "p.apellido || ', ' || p.nombre");
        assert.equal(config.fields.IdRep, 'c.idrep');

        assert.equal(config.key.field, 'PersonaId');

        assert.ok(Array.isArray(config.sql.fromClause));
        assert.equal(config.sql.fromClause[0], 'FROM personas p');
        assert.equal(config.sql.fromClause[1], 'INNER JOIN cargos c ON c.idpers = p.idpers');

        assert.ok(config.sql.whereFields);
        assert.equal(config.sql.whereFields.IdRep, 'c.idrep');
        assert.equal(config.sql.whereFields.Documento, 'p.dni');

        assert.ok(Array.isArray(config.sql.groupClause));
        assert.equal(config.sql.groupClause[0], 'ORDER BY p.apellido, p.nombre');
    });

    await t.test('parseSqlToViewConfig infiere nombres de columnas sin alias explícito', () => {
        const sql = `SELECT c.idconf, c.descripcion FROM config_server c`;
        const config = parseSqlToViewConfig(sql);

        assert.ok(config.fields.Idconf);
        assert.ok(config.fields.Descripcion);
        assert.equal(config.sql.fromClause[0], 'FROM config_server c');
    });

    await t.test('buildConfigFromOracleColumns genera configuración desde lista de columnas', () => {
        const cols = ['IDPERS', 'DNI', 'APELLIDO', 'NOMBRE'];
        const config = buildConfigFromOracleColumns('V_EMPLEADOS', cols);

        assert.equal(config.fields.Idpers, 'v.IDPERS');
        assert.equal(config.fields.Dni, 'v.DNI');
        assert.equal(config.sql.fromClause[0], 'FROM V_EMPLEADOS v');
        assert.equal(config.key.field, 'Idpers');
    });

    await t.test('lanza error si la consulta no tiene SELECT o FROM', () => {
        assert.throws(() => parseSqlToViewConfig('UPDATE personas SET nombre = 1'), /SELECT/);
        assert.throws(() => parseSqlToViewConfig('SELECT 1'), /FROM/);
    });
});
