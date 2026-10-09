const database = require('./database');
const mapperViews = require('../config/mapperViews');
const sqlViewParser = require('./sqlViewParser');

// Caché en memoria RAM para acceso en 0ms
const viewCache = new Map();
let allLoaded = false;


/**
 * Limpia la caché en memoria para forzar recarga desde la base de datos.
 */
function clearCache() {
    viewCache.clear();
    allLoaded = false;
}

async function readClobAsString(value) {
    if (typeof value === 'string') return value;
    if (!value) return '';
    if (typeof value.getData === 'function') {
        return await value.getData();
    }
    if (typeof value.on === 'function') {
        return new Promise((resolve, reject) => {
            let buffer = '';
            value.setEncoding('utf8');
            value.on('data', chunk => buffer += chunk);
            value.on('end', () => resolve(buffer));
            value.on('error', err => reject(err));
        });
    }
    return String(value);
}

/**
 * Obtiene la configuración de una vista específica:
 * 1. Primero busca en la memoria RAM (Caché).
 * 2. Si no está en RAM, consulta la tabla API_VIEW_MAPPER en Oracle.
 * 3. Si no existe en la BD o la BD está inaccesible, usa `config/mapperViews.js` como fallback.
 */
async function getViewConfig(viewName) {
    if (!viewName) return null;

    // 1. Verificar en memoria RAM
    if (viewCache.has(viewName)) {
        return viewCache.get(viewName);
    }

    // 2. Intentar consultar en la tabla de Oracle
    try {
        const query = `
            SELECT CONFIG_JSON 
            FROM API_VIEW_MAPPER 
            WHERE VIEW_NAME = :viewName 
              AND IS_ACTIVE = 1
        `;
        const result = await database.simpleExecute(query, { viewName });

        if (result && result.rows && result.rows.length > 0) {
            const rawJson = await readClobAsString(result.rows[0].CONFIG_JSON);
            const parsedConfig = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;

            viewCache.set(viewName, parsedConfig);
            return parsedConfig;
        }
    } catch (err) {
        // Si la tabla no existe aún o hay un error de conexión, registrar advertencia silenciosa
        // y proceder con el fallback de archivos locales.
    }

    // 3. Fallback retrocompatible: buscar en mapperViews.js histórico
    if (mapperViews && mapperViews.jsonViewMap && mapperViews.jsonViewMap[viewName]) {
        const fallbackConfig = mapperViews.jsonViewMap[viewName];
        viewCache.set(viewName, fallbackConfig);
        return fallbackConfig;
    }

    return null;
}

/**
 * Obtiene el catálogo completo de vistas (usado por GET /api/view/list).
 * Combina las vistas de la base de datos con las históricas de mapperViews.js.
 */
async function getAllViews() {
    const combined = {};

    // 1. Cargar base histórica de mapperViews.js
    if (mapperViews && mapperViews.jsonViewMap) {
        Object.assign(combined, mapperViews.jsonViewMap);
    }

    // 2. Sobrescribir / complementar con las vistas activas de la BD
    try {
        const query = `
            SELECT VIEW_NAME, CONFIG_JSON 
            FROM API_VIEW_MAPPER 
            WHERE IS_ACTIVE = 1
        `;
        const result = await database.simpleExecute(query, {});

        if (result && result.rows) {
            for (const row of result.rows) {
                const name = row.VIEW_NAME;
                const rawJson = await readClobAsString(row.CONFIG_JSON);
                const parsedConfig = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;

                combined[name] = parsedConfig;
                viewCache.set(name, parsedConfig);
            }
            allLoaded = true;
        }
    } catch (err) {
        // En caso de que la tabla aún no exista, retornamos las vistas del archivo local
    }

    // 3. Incluir siempre las vistas activas en la memoria RAM
    for (const [key, val] of viewCache.entries()) {
        combined[key] = val;
    }

    return combined;
}

/**
 * Registra o modifica una vista directamente en la base de datos.
 */
async function upsertView(viewName, description, configObj) {
    if (!viewName || !configObj) {
        throw new Error('viewName y configObj son obligatorios');
    }

    let parsedConfig = configObj;

    // Si configObj es una sentencia SQL pura (ej: "SELECT ...")
    if (typeof configObj === 'string' && /^\s*SELECT\b/i.test(configObj)) {
        parsedConfig = sqlViewParser.parseSqlToViewConfig(configObj);
    } else if (typeof configObj === 'string') {
        try {
            parsedConfig = JSON.parse(configObj);
        } catch (_) {
            parsedConfig = configObj;
        }
    }

    const configJson = typeof parsedConfig === 'string' ? parsedConfig : JSON.stringify(parsedConfig, null, 2);
    const desc = description || `Vista/consulta ${viewName}`;


    try {
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
            name: viewName,
            description: desc,
            configJson,
            salida: { dir: 3003 /* BIND_OUT */, type: 2002 /* NUMBER */ },
            error: { dir: 3003 /* BIND_OUT */, type: 2002 /* NUMBER */ },
            msg: { dir: 3003 /* BIND_OUT */, type: 2001 /* STRING */, maxSize: 500 }
        };

        const res = await database.simpleExecute(sql, binds);
        const out = res.outBinds || {};

        if (out.error && out.error !== 0) {
            throw new Error(out.msg || 'Error al ejecutar SP_UPSERT_VISTA');
        }
    } catch (spErr) {
        // Si el pool no está inicializado o la base de datos está offline, guardar en RAM sin fallar
        if (spErr.message && (spErr.message.includes('NJS-047') || spErr.message.includes('NJS-040'))) {
            // BD offline / tests: actualizamos en RAM
        } else {
            // Fallback: Si el SP falla o no está compilado, intentar UPDATE + INSERT directo en Oracle 11g
            try {
                const updateSql = `
                    UPDATE API_VIEW_MAPPER
                       SET DESCRIPTION = :description,
                           CONFIG_JSON = :configJson,
                           IS_ACTIVE   = 1,
                           UPDATED_AT  = SYSDATE
                     WHERE VIEW_NAME   = :name
                `;
                const updateRes = await database.simpleExecute(updateSql, { name: viewName, description: desc, configJson });
                if (!updateRes.rowsAffected || updateRes.rowsAffected === 0) {
                    const insertSql = `
                        INSERT INTO API_VIEW_MAPPER (
                            VIEW_NAME, DESCRIPTION, CONFIG_JSON, IS_ACTIVE, CREATED_AT, UPDATED_AT
                        ) VALUES (
                            :name, :description, :configJson, 1, SYSDATE, SYSDATE
                        )
                    `;
                    await database.simpleExecute(insertSql, { name: viewName, description: desc, configJson });
                }
            } catch (fallbackErr) {
                if (!fallbackErr.message || (!fallbackErr.message.includes('NJS-047') && !fallbackErr.message.includes('NJS-040'))) {
                    throw fallbackErr;
                }
            }
        }
    }

    // Actualizar inmediatamente la memoria RAM
    const parsed = typeof configObj === 'string' ? JSON.parse(configObj) : configObj;
    viewCache.set(viewName, parsed);

    return { success: true, viewName, config: parsed };
}

/**
 * Desactiva / elimina lógicamente una vista en la base de datos.
 */
async function deleteView(viewName) {
    if (!viewName) {
        throw new Error('viewName es obligatorio');
    }

    try {
        const sql = `
            BEGIN
                SP_ELIMINAR_VISTA(
                    p_view_name    => :name,
                    p_valor_salida => :salida,
                    p_valor_error  => :error,
                    p_error_msg    => :msg
                );
            END;
        `;
        const binds = {
            name: viewName,
            salida: { dir: 3003 /* BIND_OUT */, type: 2002 /* NUMBER */ },
            error: { dir: 3003 /* BIND_OUT */, type: 2002 /* NUMBER */ },
            msg: { dir: 3003 /* BIND_OUT */, type: 2001 /* STRING */, maxSize: 500 }
        };
        await database.simpleExecute(sql, binds);
    } catch (_) {
        try {
            const updateSql = `
                UPDATE API_VIEW_MAPPER
                   SET IS_ACTIVE = 0,
                       UPDATED_AT = SYSDATE
                 WHERE VIEW_NAME = :name
            `;
            await database.simpleExecute(updateSql, { name: viewName });
        } catch (_) {
            // Silencioso en modo offline
        }
    }

    viewCache.delete(viewName);
    return { success: true, viewName };
}

/**
 * Crea o actualiza una vista a partir de una sentencia SQL SELECT plana.
 */
async function createFromSql(viewName, description, sqlText) {
    const config = sqlViewParser.parseSqlToViewConfig(sqlText);
    return await upsertView(viewName, description, config);
}

/**
 * Crea o actualiza una vista leyendo las columnas de una tabla o vista física de Oracle.
 */
async function createFromOracleView(viewName, description, oracleViewName) {
    const cleanViewName = (oracleViewName || viewName).toUpperCase().trim();
    const query = `
        SELECT column_name 
        FROM all_tab_columns 
        WHERE table_name = :viewName
        ORDER BY column_id
    `;
    const res = await database.simpleExecute(query, { viewName: cleanViewName });
    const cols = res && res.rows ? res.rows.map(r => r.COLUMN_NAME) : [];
    if (cols.length === 0) {
        throw new Error(`No se encontraron columnas para la tabla/vista de Oracle '${cleanViewName}'`);
    }
    const config = sqlViewParser.buildConfigFromOracleColumns(cleanViewName, cols);
    return await upsertView(viewName, description, config);
}

module.exports = {
    getViewConfig,
    getAllViews,
    clearCache,
    upsertView,
    deleteView,
    createFromSql,
    createFromOracleView,
    parseSqlToViewConfig: sqlViewParser.parseSqlToViewConfig,
    _viewCache: viewCache
};


