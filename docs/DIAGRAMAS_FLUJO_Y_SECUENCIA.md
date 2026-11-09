# 📊 Diagramas de Flujo y Secuencia — API `node-apiliq`

Este documento detalla la arquitectura operativa, el flujo general de las peticiones HTTP y los diagramas de secuencia de los flujos críticos de la API de Sueldos y Recursos Humanos (**Oracle 11g R2 / Express 4**).

---

## 🧭 1. Diagrama de Flujo General de la API

Muestra el ciclo de vida de una petición HTTP desde su ingreso hasta la salida comprimida, atravesando capas de seguridad, enrutamiento, caché en RAM y acceso a Oracle.

```mermaid
flowchart TD
    A["Cliente HTTP (Frontend / Script / Admin Studio)"] --> B["Capa de Infraestructura y Middleware Base"]
    
    subgraph Middlewares["Middlewares Globales"]
        B --> B1["RequestId: Asigna / Propaga X-Request-ID"]
        B1 --> B2["InMemoryRateLimiter: Control DDoS y Anti-Spam por IP"]
        B2 --> B3["Body Parser: JSON y URL-Encoded"]
    end

    B3 --> C{"¿Ruta es Pública o Requiere Auth?"}
    
    C -- "Pública (/api/status, /api/health)" --> D["Ruta Pública Directa"]
    C -- "Protegida (/api/auth/login, /api/view/*, /api/sp/*, /api/admin/*, etc.)" --> E{"Evaluación de Seguridad (clientAuth / loginAuth / adminAuth)"}

    subgraph Seguridad["Capa de Autenticación Híbrida"]
        E -- "Es endpoint /api/admin/*" --> E1{"¿X-Admin-Key válida?"}
        E1 -- "No" --> E1_Err["HTTP 401 Unauthorized"]
        E1 -- "Sí" --> Dispatcher
        
        E -- "Es endpoint de login (/api/auth/login)" --> E_Log{"REQUIRE_AUTH = true?"}
        E_Log -- "No" --> Dispatcher
        E_Log -- "Sí" --> E_Log_Key{"¿X-API-Key o X-Admin-Key válida?"}
        E_Log_Key -- "No" --> E_Log_Err["HTTP 401 Unauthorized Client"]
        E_Log_Key -- "Sí" --> Dispatcher

        E -- "Es endpoint de datos (/api/view, /api/sp, /api/fn, etc.)" --> E2{"REQUIRE_AUTH = true?"}
        E2 -- "No (Modo Intranet Abierto)" --> Dispatcher
        E2 -- "Sí" --> E3{"¿X-API-Key | Bearer JWT | X-Admin-Key?"}
        E3 -- "Ninguna válida" --> E3_Err["HTTP 401 Unauthorized"]
        E3 -- "Credencial válida" --> Dispatcher
    end

    D --> Dispatcher["Despachador Central de Rutas (/api/*)"]

    subgraph Controladores["Despachadores y Servicios"]
        Dispatcher --> F1["Auth Controller: /api/auth/login, /api/adduser"]
        Dispatcher --> F2["View Controller: GET /api/view/:name"]
        Dispatcher --> F3["Procedure Controller: POST /api/sp/:name, /api/fn/:name"]
        Dispatcher --> F4["Import Controller: POST /api/import/preview, execute"]
        Dispatcher --> F5["Admin Controller: Catalog Sync, Refresh, SQL Studio"]
    end

    subgraph Persistencia["Capa de Datos y Base de Datos"]
        F1 --> G1["viewCatalog: Resuelve vista 'users' (SG_USUARIO)"]
        F2 --> G2["viewCatalog (RAM 0ms / API_VIEW_MAPPER / mapperViews.js)"]
        F2 --> G3["baseQuery: Proyección de campos + ROWNUM (Oracle 11g)"]
        F3 --> G4["procedureCatalog: Introspección ALL_ARGUMENTS + PL/SQL"]
        F4 --> G5["tableImporter: SheetJS + Introspección + executeMany"]
        
        G1 --> DB[("Oracle Database 11g R2 (Pool Thick/Thin Mode)")]
        G2 --> DB
        G3 --> DB
        G4 --> DB
        G5 --> DB
    end

    DB --> H["Respuesta Formateada en JSON"]
    H --> I["Compression Middleware: Gzip / Deflate (si > 1 KB)"]
    I --> J["Cliente Recibe HTTP 200 / 400 / 500"]
```

---

## 🔐 2. Diagrama de Secuencia: Autenticación de Usuarios (`POST /api/auth/login`)

Flujo de inicio de sesión que resuelve dinámicamente la vista de usuarios (`SG_USUARIO`), valida estado activo, verifica el hash de contraseña (Bcrypt con tolerancia legacy) y emite un JWT firmado con **HS256**.

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as Frontend (Vue 3 / Angular / Script)
    participant Router as router.js (loginAuthMiddleware)
    participant AuthCtrl as controlUsers.js (login)
    participant VC as viewCatalog.js
    participant DB as Oracle (services/database.js)
    participant Crypto as Node.js Crypto (HS256)

    Cliente->>Router: POST /api/auth/login { usr, pws } (Cabecera: X-API-Key: <API_CLIENT_KEY>)
    
    alt REQUIRE_AUTH=true y falta X-API-Key o X-Admin-Key
        Router-->>Cliente: HTTP 401 Unauthorized Client (Rebote previo sin tocar Oracle)
    else Clave de cliente válida o REQUIRE_AUTH=false
        Router->>AuthCtrl: login(req, res, next)
    end
    
    AuthCtrl->>VC: getViewConfig("users")
    Note over VC: Busca en RAM; si no está, lee API_VIEW_MAPPER o mapperViews.js
    VC-->>AuthCtrl: Retorna { fields, fromClause: ["FROM SG_USUARIO"] }

    AuthCtrl->>DB: simpleExecute("SELECT IDUS, DNI, USUARIO, CLAVE, MAIL, IDESTADOUS... FROM SG_USUARIO WHERE LOWER(USUARIO) = LOWER(:usr)", { usr })
    DB-->>AuthCtrl: Retorna filas de usuario
    
    alt Usuario no encontrado
        AuthCtrl-->>Cliente: HTTP 401 Credenciales inválidas
    else Usuario inactivo (IDESTADOUS = 0, 2 o 'I')
        AuthCtrl-->>Cliente: HTTP 403 Usuario inactivo. Contacta al administrador
    else Usuario activo
        Note over AuthCtrl: Compara contraseña (Bcrypt, plano o MD5)
        alt Contraseña incorrecta
            AuthCtrl-->>Cliente: HTTP 401 Credenciales inválidas
        else Contraseña válida
            AuthCtrl->>Crypto: createJwtHS256({ sub, userId, dni, email, role, app }, JWT_SECRET, 28800s)
            Crypto-->>AuthCtrl: Retorna token JWT (header.payload.signature)
            AuthCtrl-->>Cliente: HTTP 200 { status: "ok", token, expiresInSeconds: 28800, user: { ... } }
        end
    end
```

---

## 📑 3. Diagrama de Secuencia: Consulta de Vistas Dinámicas (`GET /api/view/:name`)

Flujo de consulta de datos que implementa caché multinivel (RAM 0 ms, catálogo en BD y fallback local), proyección de columnas bajo demanda (`fields=...`) y paginación compatible con **Oracle 11g R2** mediante subconsultas `ROWNUM`.

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as Frontend / Cliente HTTP
    participant Auth as clientAuthMiddleware
    participant ViewCtrl as control.js (view)
    participant VC as viewCatalog.js
    participant BQ as baseQuery.js
    participant DB as Oracle Pool (services/database.js)
    participant Comp as compression.js

    Cliente->>Auth: GET /api/view/empleadosPorRep?IdRep=1&fields=Id,ApeNom&limit=50&offset=0
    Auth->>Auth: Valida X-API-Key / Bearer JWT / X-Admin-Key (si REQUIRE_AUTH=true)
    Auth->>ViewCtrl: Pasa al controlador view()

    ViewCtrl->>VC: getViewConfig("empleadosPorRep")
    alt Está en Memoria RAM
        VC-->>ViewCtrl: Configuración en caché (0 ms de latencia)
    else No está en RAM pero sí en Oracle
        VC->>DB: SELECT CONFIG_JSON FROM API_VIEW_MAPPER WHERE VIEW_NAME = :viewName
        DB-->>VC: JSON de la vista
        VC->>VC: Guarda en RAM (viewCache.set)
        VC-->>ViewCtrl: Configuración deserializada
    else BD inaccesible o vista nueva no sincronizada
        VC->>VC: Lee fallback local (config/mapperViews.js)
        VC-->>ViewCtrl: Configuración de fallback
    end

    ViewCtrl->>BQ: parseSelectedFields(req.query, config.fields)
    BQ-->>ViewCtrl: Filtra columnas requeridas (ej. Id, ApeNom)
    
    ViewCtrl->>BQ: getWhereFields() / getSQLselect()
    Note over BQ: Construye SELECT con binds seguros y paginación ROWNUM (Oracle 11g)
    BQ-->>ViewCtrl: { query, binds }

    ViewCtrl->>DB: simpleExecute(fullQuery, binds)
    DB-->>ViewCtrl: { rows: [...], metaData: [...] }

    ViewCtrl->>Comp: Envía datos JSON
    Comp->>Comp: Evalúa compresión Gzip / Deflate
    Comp-->>Cliente: HTTP 200 OK (JSON comprimido)
```

---

## ⚡ 4. Diagrama de Secuencia: Ejecución de Stored Procedures (`POST /api/sp/:name`)

Flujo de ejecución de procedimientos almacenados con introspección en tiempo real (`ALL_ARGUMENTS`), vinculación de parámetros de entrada/salida (incluyendo cursores `SYS_REFCURSOR`) y clasificación determinística de errores PL/SQL (400 vs 500).

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as Frontend / Cliente HTTP
    participant SpCtrl as control.js (storeProcedure)
    participant PC as procedureCatalog.js
    participant DB as Oracle (services/database.js)

    Cliente->>SpCtrl: POST /api/sp/hojaIns { vIDREP: 1, vPERIODO: "01/09/2026", ... }
    SpCtrl->>PC: getSpConfig("hojaIns")
    
    alt Configuración en caché RAM
        PC-->>SpCtrl: Metadatos del SP (in_param, out_param, tipos)
    else Introspección en vivo
        PC->>DB: Introspecciona ALL_ARGUMENTS para el paquete/procedimiento
        DB-->>PC: Argumentos reales de Oracle
        PC->>PC: Guarda en RAM
        PC-->>SpCtrl: Metadatos calculados
    end

    SpCtrl->>SpCtrl: Mapea binds y normaliza fecha período (día 01)
    SpCtrl->>SpCtrl: Construye bloque anónimo PL/SQL: BEGIN MOD_NOV.SPI_HOJA_NOV(...); END;
    
    SpCtrl->>DB: execute(plsqlBlock, binds, { autoCommit: true })
    DB-->>SpCtrl: Retorna outBinds { ValorSalida, ValorError, vErrorMsg, Cursor }

    alt Error de Base de Datos (ValorError < 0)
        SpCtrl-->>Cliente: HTTP 500 Internal Server Error { status: 500, error: "ORA-...", ... }
    else Error de Negocio / Validación (ValorError > 0 o vErrorMsg presente)
        SpCtrl-->>Cliente: HTTP 400 Bad Request { status: 400, error: vErrorMsg, ... }
    else Ejecución Exitosa
        SpCtrl-->>Cliente: HTTP 200 OK { status: 200, out: { ... }, elapsed: "12ms" }
    end
```

---

## 📥 5. Diagrama de Secuencia: Carga Masiva de Archivos a Tablas (`POST /api/import/*`)

Flujo de importación en 2 fases (**Preview** y **Execute**) con parseo de hojas de cálculo (Excel `.xlsx`/`.xls`, `.csv`), tipado automático contra el esquema de Oracle y procesamiento por lotes atómico (`executeMany`).

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Administrador / Front de Gestión
    participant Importer as importController.js / tableImporter.js
    participant FS as Temp Storage (tmp/<uuid>.json)
    participant DB as Oracle Database

    Note over Admin,Importer: Fase 1: Preview del Archivo
    Admin->>Importer: POST /api/import/preview (Buffer binario .xlsx / .csv)
    Importer->>Importer: SheetJS parsea buffer a JSON en memoria
    Importer->>FS: Guarda archivo temporal en ./tmp/<uuid>.json
    Importer-->>Admin: HTTP 200 { uploadId, columns: [...], preview: [10 filas], totalRows }

    Note over Admin,Importer: Fase 2: Ejecución e Inserción Masiva
    Admin->>Importer: POST /api/import/execute { uploadId, tableName, mapping, truncate: true, atomic: true }
    Importer->>Importer: Valida tableName y mapping contra regex ^[A-Za-z0-9_#$]+$
    Importer->>DB: SELECT COLUMN_NAME, DATA_TYPE FROM ALL_TAB_COLUMNS WHERE TABLE_NAME = :tableName
    DB-->>Importer: Tipos de datos en Oracle (NUMBER, DATE, VARCHAR2)

    alt truncate == true
        Importer->>DB: TRUNCATE TABLE nombre_tabla (fallback a DELETE)
    end

    Importer->>FS: Lee registros procesados desde ./tmp/<uuid>.json
    Importer->>Importer: Transforma filas a matriz de binds con saneamiento

    loop Lotes de hasta 2000 registros
        Importer->>DB: connection.executeMany(insertSql, batchBinds, { bindDefs })
    end

    alt Todo el lote exitoso
        Importer->>DB: connection.commit()
        Importer->>FS: Elimina ./tmp/<uuid>.json (finally)
        Importer-->>Admin: HTTP 200 { status: "ok", insertedRows, elapsed }
    else Error en cualquier lote (y atomic == true)
        Importer->>DB: connection.rollback()
        Importer->>FS: Elimina ./tmp/<uuid>.json (finally)
        Importer-->>Admin: HTTP 400 / 500 { error: "Fallo durante la importación", detail }
    end
```

---

## 🛡️ 6. Resumen de Invariantes Reflejados en los Diagramas

1. **Paginación Oracle 11g R2:** Subconsultas anidadas con `ROWNUM` (sin `FETCH NEXT`).
2. **Cero Concatenación SQL:** Todo parámetro de filtro o procedimiento viaja a través de binds tipados (`:usr`, `:b_0`, `:maxRow`).
3. **Normalización de Fechas:** Todo período de liquidación (`PERIODO`) se normaliza al **día 01 del mes** en hora local (`01/MM/YYYY`).
4. **Caché en Memoria RAM (0 ms):** `viewCatalog` y `procedureCatalog` resuelven en microsegundos sin sobrecargar el catálogo del diccionario de datos de Oracle.
5. **Autenticación Híbrida Desacoplada:** Acceso flexible para scripts internos (`X-API-Key`), usuarios finales autenticados (`Bearer JWT`) y tareas administrativas (`X-Admin-Key`).
