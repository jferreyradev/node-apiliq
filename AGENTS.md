# AGENTS.md — Guía y Contexto Técnico para Agentes IA

Este documento está optimizado para que cualquier agente de inteligencia artificial (Antigravity, Claude Code, Cursor, Copilot, Devin, etc.) o subagente autónomo entienda de inmediato la arquitectura, invariantes críticos, restricciones de compatibilidad y patrones de diseño de este repositorio.

---

## 🧭 1. Resumen del Proyecto y Stack Tecnológico

* **Nombre del Proyecto:** `node-apiliq` (api_liquid)
* **Entorno de Ejecución:** Node.js 18+ / 20+ LTS (CommonJS: `require` / `module.exports`).
* **Framework Web:** Express 4.x.
* **Base de Datos:** **Oracle Database 11g Release 2 (11.2.x)** (también compatible con 12c/19c/21c).
* **Driver de Base de Datos:** `oracledb` 7.x (requiere Thick Mode para 11g, ver sección 3).
* **Testing:** Node.js Built-in Test Runner (`node --test`). Sin Jest ni Mocha.
* **Procesamiento de Archivos:** `xlsx` (SheetJS) para `.xlsx`, `.xls`, `.csv`, `.tsv`, `.txt`.
* **Generación de PDFs:** `pdf-lib`.

---

## ⚠️ 2. Invariantes Críticos (REGLAS OBLIGATORIAS)

Cualquier agente que modifique este código **DEBE** respetar estas reglas:

### Regla 1: Compatibilidad Estricta con Oracle 11g Release 2
* ❌ **NUNCA** uses sintaxis moderna de Oracle 12c+ como `OFFSET ... ROWS FETCH NEXT ... ROWS ONLY`. Romperá la base de datos de producción.
* ❌ **NUNCA** uses funciones nativas JSON de Oracle (`JSON_OBJECT`, `JSON_ARRAY`, `JSON_TABLE`). No existen en 11g.
* ✅ **Paginación en 11g:** Utiliza siempre el patrón de subconsulta con `ROWNUM` implementado en `db_apis/baseQuery.js`:
  ```sql
  SELECT * FROM (
    SELECT a.*, ROWNUM rnum FROM (
      SELECT ... FROM ... ORDER BY ...
    ) a WHERE ROWNUM <= :maxRow
  ) WHERE rnum > :minRow
  ```

### Regla 2: Cero Inyecciones SQL (Uso Obligatorio de Binds)
* ❌ **NUNCA** concatenes cadenas de usuario dentro de consultas SQL (`WHERE campo = '` + valor + `'`).
* ✅ Usa siempre parámetros bind nombrados (`:campo`, `:b_0`, etc.) y pásalos en el objeto/array de binds a `execute()` o `executeMany()`.
* ✅ Si necesitas validar nombres de tablas o columnas dinámicas (ej. importador o SQL Studio), usa `tableImporter.validateIdentifier(tableName)` y `validateColumnName(colName)` con regex estricta `/^[A-Za-z0-9_#$]+$/`.

### Regla 3: 100% Retrocompatibilidad con Frontends Existentes
* ❌ **NUNCA** elimines ni cambies los nombres de los endpoints legacy ni de las vistas maestras.
* Frontends en producción (Angular, Deno, Vue) consumen endpoints históricos como:
  - `POST /api/sp/hojaIns`
  - `POST /api/sp/novHaberesDel`
  - `POST /api/sp/cargoIns`
  - `GET /api/generaNovIPSST?uploadId=...`
  - `POST /api/fileUpload`
  - `GET /api/view/:name`

### Regla 4: Arquitectura Headless (Frontend de Gestión Desacoplado)
* La API `node-apiliq` opera exclusivamente como un servicio REST headless de alta velocidad.
* El frontend y consola de administración se gestiona de forma desacoplada en el proyecto `dno-admin-bridge` (o clientes como `liq-panel`).
* ❌ **NUNCA** reintroduzcas archivos HTML/CSS pesados ni dependencias de interfaz en este backend.

### Regla 5: Suite de Tests Siempre en Verde
* Antes de dar por finalizada una tarea, corre:
  ```bash
  npm test
  ```
  Todas las pruebas (72+ tests) deben pasar con 0 fallos.

---

## 🗺️ 3. Mapa de la Arquitectura del Código

```text
api_liquid/
├── config/
│   ├── database.js          # Configuración del pool Oracle y timeouts
│   ├── web_server.js        # Puertos (PORT=3005) y host
│   ├── mapper.js            # Mapeo de entidades (CRUD básico)
│   ├── mapperViews.js       # Vistas estáticas de fallback
│   ├── spmapper.js          # Catálogo estático de Stored Procedures
│   └── fnmapper.js          # Catálogo estático de Funciones
├── controllers/
│   ├── control.js           # Despachador principal (views, SPs, FNs, reportes)
│   ├── importController.js  # Endpoints de carga masiva (/api/import/*)
│   ├── files.js             # Uploads de novedades fijas IPSST
│   └── controlUsers.js      # Creación de usuarios con JWT
├── db_apis/
│   ├── baseQuery.js         # Constructor dinámico de SELECTs, WHERE, ORDER BY y ROWNUM
│   ├── entityapi.js         # Ejecutor genérico de CRUD sobre tablas
│   ├── files.js             # Lógica de inserción de novedades IPSST (HOJA_NOV, NOVIPSST)
│   └── writeTempFile.js     # Gestor de archivos temporales en ./tmp/<uuid>.json
├── services/
│   ├── database.js          # Inicialización de Oracle Client (Thick/Thin) y Pool
│   ├── router.js            # Router central Express y montaje de rutas /api/*
│   ├── viewCatalog.js       # Caché RAM de vistas + tabla Oracle API_VIEW_MAPPER
│   ├── procedureCatalog.js  # Introspección en vivo de SPs/FNs desde ALL_ARGUMENTS
│   ├── sqlViewParser.js     # Auto-parser de sentencias SELECT planas
│   ├── tableImporter.js     # Parseo Excel/CSV y executeMany por lotes en Oracle
│   └── adminAuth.js         # Middleware de autenticación X-Admin-Key (timing-safe)
├── scripts/
│   ├── oracle_api_view_mapper.sql  # DDL de la tabla de catálogo en Oracle
│   ├── seed_views.sql              # Inserción de las 54 consultas iniciales
│   └── test-oracle-client.js       # Script de diagnóstico del Instant Client
└── test/
    ├── baseQuery.test.js    # Tests unitarios del generador SQL
    ├── tableImporter.test.js# Tests del importador y endpoints HTTP
    ├── routerSmoke.test.js  # Tests de rutas sin base de datos
    └── integration.test.js  # Tests con Oracle real (RUN_INTEGRATION=1)
```

---

## ⚙️ 4. Flujos Clave de la API

### Flujo A: Consultas y Vistas Dinámicas (`GET /api/view/:name`)
1. Llega la petición: `GET /api/view/empleadosPorRep?IdRep=1&fields=PersonaId,ApeNom&limit=50&offset=0`.
2. `viewCatalog.getViewConfig(name)` busca en la **memoria RAM** (latencia 0 ms).
   - Si no está en RAM, consulta la tabla `API_VIEW_MAPPER` en Oracle.
   - Si la BD está caída, recurre al fallback local `config/mapperViews.js`.
3. `baseQuery.parseSelectedFields(context, config.fields)` resuelve las columnas solicitadas si se indicó `fields` o `columns` (con validación estricta y case-insensitive).
4. `viewapi.getView()` / `baseQuery.getWhereFields()` construye el `SELECT` proyectando sólo los campos requeridos (o todos si se omite), aplicando filtros con binds y paginación `ROWNUM`.
5. `database.simpleExecute(sql, binds)` ejecuta en Oracle y retorna el JSON.

### Flujo B: Creación Automática de Vistas (`POST /api/view/save`)
1. Se envía: `{ "viewName": "miVista", "sql": "SELECT ... FROM ... WHERE ...", "description": "..." }`.
2. Header requerido: `X-Admin-Key: <ADMIN_ACCESS_KEY>`.
3. `sqlViewParser.parseSqlToViewConfig(sqlText)` desglosa columnas, alias, tablas, joins y filtros `:param`.
4. Se guarda en Oracle mediante `API_VIEW_MAPPER_PKG.UPSERT_VIEW` y se actualiza la memoria RAM inmediatamente sin reiniciar el servidor.

### Flujo C: Stored Procedures en Tiempo Real (`POST /api/sp/:name`)
1. El usuario invoca `POST /api/sp/hojaIns` con `{ "vIDREP": 1, ... }`.
2. `procedureCatalog.getSpConfig(name)` consulta `ALL_ARGUMENTS` en Oracle para descubrir tipos y direcciones (`IN`, `OUT`, `IN/OUT`).
3. Construye el bloque PL/SQL anónimo dinámicamente y mapea binds de entrada y cursores `CURSOR` o valores de salida.

### Flujo D: Carga Masiva de Archivos a Tablas (`POST /api/import/*`)
1. **Paso 1 (Preview):** `POST /api/import/preview` recibe buffer binario `.xlsx` o `.csv`.
   - SheetJS parsea la primera hoja (o la solicitada).
   - Guarda JSON temporal en `tmp/<uploadId>.json`.
   - Retorna columnas encontradas y muestra de 10 filas.
2. **Paso 2 (Execute):** `POST /api/import/execute` recibe `{ uploadId, tableName, mapping, truncate, atomic }`.
   - Valida nombre de tabla y columnas con regex.
   - Introspecciona columnas de la tabla en Oracle (`all_tab_columns`) para tipar `bindDefs` (`NUMBER`, `DATE`, `STRING`).
   - Si `truncate=true`, ejecuta `TRUNCATE TABLE` (con fallback a `DELETE`).
   - Inserta lotes de 2000 registros usando `connection.executeMany()`.
   - Si `atomic=true`, hace `commit()` al final o `rollback()` total ante fallos.
   - Elimina el archivo temporal en `finally`.

### Flujo E: Sincronización e Importación de Vistas (`POST /api/view/seed-from-file`, `POST /api/view/import-json`)
1. **Sincronización de archivo local:** `POST /api/view/seed-from-file` toma `config/mapperViews.local.js` (o `mapperViews.js` de fallback) y puebla la tabla `API_VIEW_MAPPER` de ese servidor con `SP_UPSERT_VISTA`.
2. **Importación masiva por JSON:** `POST /api/view/import-json` recibe un lote JSON `{ viewName: config, ... }` y registra/actualiza todas las vistas en Oracle sin necesidad de acceso por consola o SSH.
3. **Aislamiento Multi-despliegue:** Para clientes con vistas particulares, el archivo `config/mapperViews.local.*` está ignorado en Git (`.gitignore`) para permitir `git pull origin main` sin conflictos de merge.

---

## 🧪 5. Comandos de Prueba y Diagnóstico

| Acción | Comando | Notas |
| :--- | :--- | :--- |
| **Correr suite completa** | `npm test` | No requiere base de datos Oracle viva (usa mocks y fallbacks). |
| **Test unitario específico**| `node --test test/tableImporter.test.js` | Prueba rápida de un módulo. |
| **Test de Instant Client** | `node scripts/test-oracle-client.js` | Diagnostica librerías C de Oracle. |
| **Pruebas con BD Real** | `RUN_INTEGRATION=1 npm test` | Requiere VPN / conexión a Oracle activa. |

---

## 🔑 6. Cabeceras y Autenticación para Pruebas

Al hacer peticiones HTTP en desarrollo o tests:
* **Admin Key:** `X-Admin-Key: <ADMIN_ACCESS_KEY>` (por defecto en local: `admin_liq_2026`).
* **Content-Type para Archivos Binarios:** `Content-Type: application/octet-stream` con `X-File-Name: nombre.xlsx`.
* **Content-Type para JSON:** `Content-Type: application/json`.
