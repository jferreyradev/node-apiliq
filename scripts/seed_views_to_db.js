/**
 * Script para migrar/poblar las vistas actuales de `config/mapperViews.js`
 * hacia la tabla `API_VIEW_MAPPER` en Oracle.
 *
 * Uso:
 *   node scripts/seed_views_to_db.js
 *
 * Si la red o VPN no permite conectar a Oracle desde Node.js,
 * puedes ejecutar directamente el script SQL en DBeaver / SQL Developer:
 *   scripts/seed_views.sql
 */

require('dotenv').config();
const oracledb = require('oracledb');
const database = require('../services/database');
const mapperViews = require('../config/mapperViews');
const dbConfig = require('../config/database');

async function seedViews() {
    let conn = null;
    try {
        console.log('--- Iniciando migración de vistas a API_VIEW_MAPPER ---');
        console.log(`Destino: ${dbConfig.dbPool.user}@${dbConfig.dbPool.connectionString}`);

        await database.initialize();

        // 1. Validar conectividad antes de iterar para evitar bloqueos prolongados
        console.log('Probando conectividad con Oracle...');
        try {
            conn = await database.getConnection();
            console.log('Conexión establecida con éxito.\n');
        } catch (connErr) {
            console.error('\n============================================================');
            console.error('[ERROR DE CONEXIÓN A ORACLE]');
            console.error(`No se pudo conectar a: ${dbConfig.dbPool.connectionString}`);
            console.error(`Detalle: ${connErr.message}`);
            console.error('------------------------------------------------------------');
            console.error('POSIBLES CAUSAS:');
            console.error(' 1. La VPN no está activa o la IP del servidor cambió.');
            console.error(' 2. El puerto 1521 está bloqueado por firewall.');
            console.error(' 3. Revisa la variable CONNECTIONSTRING en tu archivo .env.');
            console.error('');
            console.error('SOLUCIÓN RECOMENDADA (Sin necesidad de Node.js):');
            console.error(' Ejecuta directamente el script SQL en tu cliente (DBeaver o SQL Developer):');
            console.error('   1) scripts/oracle_api_view_mapper.sql   (Crea tabla y procedimientos)');
            console.error('   2) scripts/seed_views.sql               (Inserta las 54 vistas)');
            console.error('============================================================\n');
            process.exitCode = 1;
            return;
        }

        const views = mapperViews.jsonViewMap || {};
        const viewNames = Object.keys(views);

        console.log(`Total de vistas a sincronizar: ${viewNames.length}`);

        let insertCount = 0;
        let errorCount = 0;

        for (const name of viewNames) {
            const configObj = views[name];
            const configJson = JSON.stringify(configObj);
            const description = `Vista/consulta ${name}`;

            try {
                // Intentar primero usando el Stored Procedure SP_UPSERT_VISTA
                const sql = `
                    BEGIN
                        SP_UPSERT_VISTA(
                            p_view_name    => :name,
                            p_description  => :description,
                            p_config_json  => :configJson,
                            p_valor_salida => :salida,
                            p_valor_error  => :error,
                            p_error_msg    => :msg
                        );
                    END;
                `;
                const binds = {
                    name,
                    description,
                    configJson,
                    salida: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
                    error: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
                    msg: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 500 }
                };

                const res = await conn.execute(sql, binds, { autoCommit: true });
                const out = res.outBinds || {};

                if (out.error && out.error !== 0) {
                    console.error(`  [ERROR] ${name}: ${out.msg}`);
                    errorCount++;
                } else {
                    insertCount++;
                    if (insertCount % 10 === 0 || insertCount === viewNames.length) {
                        console.log(`  Procesadas ${insertCount}/${viewNames.length} vistas...`);
                    }
                }
            } catch (err) {
                // Fallback: si el SP aún no está compilado, intentar UPDATE + INSERT directo (compatible 11g)
                try {
                    const updateSql = `
                        UPDATE API_VIEW_MAPPER
                           SET DESCRIPTION = :description,
                               CONFIG_JSON = :configJson,
                               IS_ACTIVE   = 1,
                               UPDATED_AT  = SYSDATE
                         WHERE VIEW_NAME   = :name
                    `;
                    const updateRes = await conn.execute(updateSql, { name, description, configJson }, { autoCommit: false });
                    if (!updateRes.rowsAffected || updateRes.rowsAffected === 0) {
                        const insertSql = `
                            INSERT INTO API_VIEW_MAPPER (
                                VIEW_NAME, DESCRIPTION, CONFIG_JSON, IS_ACTIVE, CREATED_AT, UPDATED_AT
                            ) VALUES (
                                :name, :description, :configJson, 1, SYSDATE, SYSDATE
                            )
                        `;
                        await conn.execute(insertSql, { name, description, configJson }, { autoCommit: false });
                    }
                    await conn.commit();
                    insertCount++;
                    if (insertCount % 10 === 0 || insertCount === viewNames.length) {
                        console.log(`  Procesadas ${insertCount}/${viewNames.length} vistas...`);
                    }
                } catch (fallbackErr) {
                    console.error(`  [FALLO] No se pudo guardar ${name}:`, fallbackErr.message);
                    errorCount++;
                }
            }
        }

        console.log(`\n--- Migración Finalizada ---`);
        console.log(`Exitosas: ${insertCount}`);
        console.log(`Fallidas: ${errorCount}`);

    } catch (error) {
        console.error('Error general durante la migración:', error);
        process.exitCode = 1;
    } finally {
        if (conn) {
            try {
                await conn.close();
            } catch (_) {}
        }
        try {
            await database.close();
        } catch (_) {}
    }
}

if (require.main === module) {
    seedViews();
}

module.exports = { seedViews };
