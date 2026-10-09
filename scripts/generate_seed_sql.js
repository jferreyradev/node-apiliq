/**
 * Generador automático de script SQL para poblar la tabla API_VIEW_MAPPER en Oracle.
 * Lee la configuración actual de `config/mapperViews.js` y genera `scripts/seed_views.sql`.
 *
 * Compatible con: Oracle 11g, 12c, 19c, 21c, 23c.
 *
 * Uso:
 *   node scripts/generate_seed_sql.js
 */

const fs = require('fs');
const path = require('path');
const mapperViews = require('../config/mapperViews');

function generateSql() {
    const views = mapperViews.jsonViewMap || {};
    const viewNames = Object.keys(views);
    const outputPath = path.resolve(__dirname, 'seed_views.sql');

    console.log(`Generando script SQL para ${viewNames.length} vistas...`);

    const chunkSize = 15;
    const chunks = [];
    for (let i = 0; i < viewNames.length; i += chunkSize) {
        chunks.push(viewNames.slice(i, i + chunkSize));
    }

    let sql = `-- ====================================================================\n`;
    sql += `-- Script de Carga Inicial (Seed) de Vistas en API_VIEW_MAPPER\n`;
    sql += `-- Compatible con: Oracle 11g (11.2.x), 12c, 19c, 21c, 23c\n`;
    sql += `-- Esquema objetivo: US_SUELDO\n`;
    sql += `-- Total de vistas generadas: ${viewNames.length}\n`;
    sql += `-- Fecha de generación: ${new Date().toISOString()}\n`;
    sql += `-- ====================================================================\n\n`;
    sql += `SET DEFINE OFF;\n`;
    sql += `SET SERVEROUTPUT ON;\n\n`;

    chunks.forEach((chunk, chunkIndex) => {
        const chunkNum = chunkIndex + 1;
        const startIdx = chunkIndex * chunkSize + 1;
        const endIdx = Math.min((chunkIndex + 1) * chunkSize, viewNames.length);

        sql += `-- --------------------------------------------------------------------\n`;
        sql += `-- BLOQUE ${chunkNum} DE ${chunks.length} (Vistas ${startIdx} a ${endIdx})\n`;
        sql += `-- --------------------------------------------------------------------\n`;
        sql += `DECLARE\n`;
        sql += `    PROCEDURE upsert_view(p_name IN VARCHAR2, p_desc IN VARCHAR2, p_json IN CLOB) IS\n`;
        sql += `    BEGIN\n`;
        sql += `        UPDATE API_VIEW_MAPPER\n`;
        sql += `           SET DESCRIPTION = NVL(p_desc, DESCRIPTION),\n`;
        sql += `               CONFIG_JSON = p_json,\n`;
        sql += `               IS_ACTIVE   = 1,\n`;
        sql += `               UPDATED_AT  = SYSDATE\n`;
        sql += `         WHERE VIEW_NAME   = p_name;\n\n`;
        sql += `        IF SQL%ROWCOUNT = 0 THEN\n`;
        sql += `            INSERT INTO API_VIEW_MAPPER (\n`;
        sql += `                VIEW_NAME, DESCRIPTION, CONFIG_JSON, IS_ACTIVE, CREATED_AT, UPDATED_AT\n`;
        sql += `            ) VALUES (\n`;
        sql += `                p_name, p_desc, p_json, 1, SYSDATE, SYSDATE\n`;
        sql += `            );\n`;
        sql += `        END IF;\n`;
        sql += `    EXCEPTION\n`;
        sql += `        WHEN OTHERS THEN\n`;
        sql += `            DBMS_OUTPUT.PUT_LINE('Error en vista ' || p_name || ': ' || SQLERRM);\n`;
        sql += `    END;\n`;
        sql += `BEGIN\n`;

        chunk.forEach(name => {
            const configObj = views[name];
            const configJson = JSON.stringify(configObj);
            const sqlEscapedJson = configJson.replace(/'/g, "''");
            const description = `Vista/consulta ${name}`;

            sql += `    upsert_view(\n`;
            sql += `        '${name}',\n`;
            sql += `        '${description}',\n`;
            sql += `        '${sqlEscapedJson}'\n`;
            sql += `    );\n`;
        });

        sql += `    COMMIT;\n`;
        sql += `    DBMS_OUTPUT.PUT_LINE('Bloque ${chunkNum}/${chunks.length} procesado exitosamente.');\n`;
        sql += `END;\n`;
        sql += `/\n\n`;
    });

    sql += `-- Verificación final del total de registros cargados\n`;
    sql += `SELECT COUNT(*) AS TOTAL_VISTAS_ACTIVAS FROM API_VIEW_MAPPER WHERE IS_ACTIVE = 1;\n`;

    fs.writeFileSync(outputPath, sql, 'utf8');
    console.log(`Script generado exitosamente en: ${outputPath}`);
}

if (require.main === module) {
    generateSql();
}

module.exports = { generateSql };
