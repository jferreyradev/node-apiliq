/**
 * Parser inteligente de consultas SQL para generar automáticamente
 * la configuración JSON requerida por API_VIEW_MAPPER.
 */

function toPascalCase(str) {
    if (!str) return '';
    const cleaned = str.replace(/^(P_|V_|IN_|OUT_)/i, '');
    return cleaned
        .toLowerCase()
        .replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase())
        .replace(/^[a-z]/, letter => letter.toUpperCase());
}

/**
 * Divide una lista de expresiones separadas por coma en el nivel superior,
 * ignorando las comas que estén dentro de paréntesis o comillas literales.
 */
function splitTopLevelCommas(str) {
    const parts = [];
    let current = '';
    let parenDepth = 0;
    let inQuotes = false;

    for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (ch === "'" && str[i - 1] !== '\\') {
            inQuotes = !inQuotes;
        }

        if (!inQuotes) {
            if (ch === '(') parenDepth++;
            if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);

            if (ch === ',' && parenDepth === 0) {
                if (current.trim()) {
                    parts.push(current.trim());
                }
                current = '';
                continue;
            }
        }
        current += ch;
    }

    if (current.trim()) {
        parts.push(current.trim());
    }

    return parts;
}

/**
 * Convierte una sentencia SELECT completa en la estructura de configuración de API_VIEW_MAPPER.
 *
 * Entrada admitida:
 *   "SELECT p.idpers AS PersonaId, p.dni AS Documento, p.apellido || ', ' || p.nombre AS ApeNom
 *    FROM personas p
 *    INNER JOIN cargos c ON c.idpers = p.idpers
 *    WHERE c.idrep = :IdRep AND p.dni = :Documento
 *    ORDER BY p.apellido, p.nombre"
 */
function parseSqlToViewConfig(rawSql) {
    if (!rawSql || typeof rawSql !== 'string') {
        throw new Error('La consulta SQL debe ser una cadena de texto no vacía.');
    }

    // 1. Limpieza básica y normalización
    let sql = rawSql.trim().replace(/;+\s*$/, '');
    // Quitar comentarios SQL de una línea (-- ...)
    sql = sql.replace(/--.*$/gm, '');

    const selectMatch = sql.search(/\bSELECT\b/i);
    if (selectMatch === -1) {
        throw new Error('La consulta SQL debe comenzar con SELECT.');
    }

    const fromMatch = sql.search(/\bFROM\b/i);
    if (fromMatch === -1) {
        throw new Error('La consulta SQL debe contener una cláusula FROM.');
    }


    // Extraer bloque SELECT
    const selectSection = sql.substring(selectMatch + 6, fromMatch).trim();
    const remainder = sql.substring(fromMatch);

    // Buscar WHERE, GROUP BY, ORDER BY en el resto
    const whereMatch = remainder.search(/\bWHERE\b/i);
    const groupMatch = remainder.search(/\bGROUP\s+BY\b/i);
    const orderMatch = remainder.search(/\bORDER\s+BY\b/i);

    // Delimitar sección FROM
    let fromEnd = remainder.length;
    if (whereMatch !== -1) {
        fromEnd = Math.min(fromEnd, whereMatch);
    } else if (groupMatch !== -1) {
        fromEnd = Math.min(fromEnd, groupMatch);
    } else if (orderMatch !== -1) {
        fromEnd = Math.min(fromEnd, orderMatch);
    }

    const fromSection = remainder.substring(0, fromEnd).trim();

    // Normalizar cláusula FROM separando los JOINs en renglones
    const normalizedFrom = fromSection.replace(
        /\s+((?:INNER|LEFT(?:\s+OUTER)?|RIGHT(?:\s+OUTER)?|FULL(?:\s+OUTER)?|CROSS)?\s*JOIN\b)/gi,
        '\n$1'
    );
    const fromClause = normalizedFrom
        .split(/\r?\n/)
        .map(s => s.trim())
        .filter(Boolean);

    // Procesar campos SELECT
    const rawFields = splitTopLevelCommas(selectSection);
    const fields = {};
    const whereFields = {};

    rawFields.forEach(rawField => {
        // Detectar si tiene alias explícito: 'expr AS alias' o 'expr alias'
        // Respetando casos complejos como concatenaciones (||) o case when
        const asMatch = rawField.match(/^(.*?)\s+AS\s+([a-zA-Z0-9_]+)$/i) ||
                        rawField.match(/^(.*?)\s+([a-zA-Z0-9_]+)$/i);

        let expr = rawField.trim();
        let alias = '';

        if (asMatch && asMatch[1] && !asMatch[1].endsWith('||')) {
            expr = asMatch[1].trim();
            alias = asMatch[2].trim();
        } else {
            // Sin alias explícito: extraer el nombre de la columna
            const lastPart = expr.includes('.') ? expr.split('.').pop() : expr;
            const cleanCol = lastPart.replace(/[^a-zA-Z0-9_]/g, '');
            alias = toPascalCase(cleanCol) || 'Campo';
        }

        fields[alias] = expr;
        whereFields[alias] = expr;
    });

    // Procesar WHERE si existe para mapear bind variables específicas (:IdRep, :Periodo, etc.)
    if (whereMatch !== -1) {
        let whereEnd = remainder.length;
        if (groupMatch !== -1 && groupMatch > whereMatch) {
            whereEnd = Math.min(whereEnd, groupMatch);
        } else if (orderMatch !== -1 && orderMatch > whereMatch) {
            whereEnd = Math.min(whereEnd, orderMatch);
        }

        const whereSection = remainder.substring(whereMatch + 5, whereEnd).trim();
        const bindRegex = /([a-zA-Z0-9_.]+)\s*(?:=|>|<|>=|<=|LIKE|IN)\s*:([a-zA-Z0-9_]+)/gi;
        let m;
        while ((m = bindRegex.exec(whereSection)) !== null) {
            const col = m[1].trim();
            const param = m[2].trim();
            whereFields[param] = col;
        }
    }

    // Procesar GROUP BY y ORDER BY
    const groupClause = [];
    if (groupMatch !== -1) {
        const groupPart = orderMatch !== -1 && orderMatch > groupMatch
            ? remainder.substring(groupMatch, orderMatch).trim()
            : remainder.substring(groupMatch).trim();
        groupClause.push(groupPart);
    }

    if (orderMatch !== -1) {
        groupClause.push(remainder.substring(orderMatch).trim());
    }

    // Determinar clave primaria (preferir 'Id', 'PersonaId', 'LiquidacionId' o el primer campo)
    const fieldKeys = Object.keys(fields);
    const preferredKey = fieldKeys.find(k => /(?:^id|id$|id[a-z]+)/i.test(k)) || fieldKeys[0] || 'Id';

    const config = {
        fields,
        key: { field: preferredKey },
        sql: {
            fromClause,
            whereFields
        }
    };

    if (groupClause.length > 0) {
        config.sql.groupClause = groupClause;
    }

    return config;
}

/**
 * Genera la configuración de una vista a partir de las columnas de una tabla o vista de Oracle.
 */
function buildConfigFromOracleColumns(tableName, columns = []) {
    if (!tableName) throw new Error('tableName es obligatorio');

    const fields = {};
    const whereFields = {};

    columns.forEach(col => {
        const colName = typeof col === 'string' ? col : col.COLUMN_NAME;
        const alias = toPascalCase(colName);
        fields[alias] = `v.${colName}`;
        whereFields[alias] = `v.${colName}`;
    });

    const fieldKeys = Object.keys(fields);
    const preferredKey = fieldKeys.find(k => /(?:^id|id$)/i.test(k)) || fieldKeys[0] || 'Id';

    return {
        fields,
        key: { field: preferredKey },
        sql: {
            fromClause: [`FROM ${tableName} v`],
            whereFields
        }
    };
}

module.exports = {
    parseSqlToViewConfig,
    buildConfigFromOracleColumns,
    splitTopLevelCommas,
    toPascalCase
};
