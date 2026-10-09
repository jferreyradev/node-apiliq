/**
 * Script de utilidad para crear o generar una consulta lista para API_VIEW_MAPPER.
 * Permite pasar un SELECT SQL en texto plano y genera automáticamente la configuración.
 *
 * Uso:
 *   1. Generar PL/SQL desde un SELECT puro:
 *      node scripts/create_view.js --name miConsulta "SELECT p.idpers AS PersonaId, p.dni FROM personas p WHERE p.idpers = :PersonaId"
 *
 *   2. Convertir un archivo JSON a PL/SQL:
 *      node scripts/create_view.js ruta/miVista.json
 *
 *   3. Ver plantilla de ejemplo:
 *      node scripts/create_view.js --template
 */

const fs = require('fs');
const path = require('path');
const { parseSqlToViewConfig } = require('../services/sqlViewParser');

function formatUpsertSql(viewName, description, config) {
    const configJson = JSON.stringify(config, null, 2);
    const sqlEscaped = configJson.replace(/'/g, "''");
    const desc = description || `Vista/consulta ${viewName}`;

    return `DECLARE
    v_salida NUMBER;
    v_error  NUMBER;
    v_msg    VARCHAR2(400);
BEGIN
    SP_UPSERT_VISTA(
        p_view_name   => '${viewName}',
        p_description => '${desc}',
        p_config_json => '${sqlEscaped}',
        p_valor_salida => v_salida,
        p_valor_error  => v_error,
        p_error_msg    => v_msg
    );
    COMMIT;
    DBMS_OUTPUT.PUT_LINE('Resultado: Salida=' || v_salida || ', Error=' || v_error || ' ' || NVL(v_msg, 'OK'));
END;
/
`;
}

function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help')) {
        console.log(`
Uso del creador automático de vistas para API_VIEW_MAPPER:

  1. A partir de una sentencia SQL SELECT (automático):
     node scripts/create_view.js --name miConsulta "SELECT p.idpers AS PersonaId, p.dni AS Documento FROM personas p WHERE p.idpers = :PersonaId"

  2. A partir de un archivo JSON:
     node scripts/create_view.js ruta/archivo.json

  3. Vía API REST (directo con curl):
     curl -X POST http://localhost:3005/api/view/save \\
          -H "Content-Type: application/json" \\
          -d '{
            "viewName": "miConsulta",
            "sql": "SELECT p.idpers AS PersonaId, p.dni AS Documento FROM personas p WHERE p.idpers = :PersonaId"
          }'
        `);
        return;
    }

    if (args.includes('--template')) {
        const template = {
            viewName: "ejemploConsulta",
            description: "Descripción de la consulta",
            sql: "SELECT p.idpers AS PersonaId, p.dni AS Documento, p.apellido || ', ' || p.nombre AS ApeNom FROM personas p INNER JOIN cargos c ON c.idpers = p.idpers WHERE c.idrep = :IdRep ORDER BY p.apellido, p.nombre"
        };
        console.log(JSON.stringify(template, null, 2));
        return;
    }

    // Verificar si se pasa --name
    let viewName = 'nuevaConsulta';
    let sqlQuery = null;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--name' && args[i + 1]) {
            viewName = args[i + 1];
            i++;
        } else if (/^\s*SELECT\b/i.test(args[i])) {
            sqlQuery = args[i];
        }
    }

    if (sqlQuery) {
        console.log(`\nParseando consulta SQL para la vista '${viewName}'...`);
        const config = parseSqlToViewConfig(sqlQuery);
        const sql = formatUpsertSql(viewName, `Vista ${viewName}`, config);
        console.log('\n-- SQL listo para ejecutar en DBeaver / SQL Developer:\n');
        console.log(sql);
        return;
    }

    const filePath = args[0];
    if (filePath && fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(raw);
        const name = data.viewName || path.basename(filePath, path.extname(filePath));
        const description = data.description || `Vista ${name}`;
        
        let config = data.config;
        if (!config && data.sql && typeof data.sql === 'string') {
            config = parseSqlToViewConfig(data.sql);
        } else if (!config) {
            config = data;
        }

        const sql = formatUpsertSql(name, description, config);
        console.log('\n-- SQL listo para ejecutar en DBeaver / SQL Developer:\n');
        console.log(sql);
    } else {
        console.error(`Entrada no reconocida. Ejecuta con --help para ver ejemplos.`);
    }
}

if (require.main === module) {
    main();
}

module.exports = { formatUpsertSql };
