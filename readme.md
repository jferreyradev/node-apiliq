# API REST Sueldos (api_liquid / node-apiliq)

API REST robusta construida con **Node.js, Express y Oracle Database (11g/12c/19c)** para la gestión y liquidación de sueldos municipales, generación de boletas PDF, reportes Excel/TXT, intercambio de novedades IPSST y ejecución dinámica de procedimientos y consultas.

> 🚀 **¿Necesitas instalar el servidor desde cero rápidamente?** Consulta la **[Guía Rápida de Puesta en Marcha para Terceros (PUESTA_EN_MARCHA.md)](PUESTA_EN_MARCHA.md)** con instrucciones detalladas para Linux (Ubuntu/Debian/RHEL), macOS y Windows.

---

## 🌟 Características Principales

* **Arquitectura Dinámica Zero-Config**: Se prescinde de la edición manual de archivos de mapeo en tiempo de ejecución.
* **Catálogo de Consultas en Base de Datos**: Las vistas y consultas residen en la tabla `API_VIEW_MAPPER` con recarga en memoria RAM (0 ms de latencia) y fallback automático.
* **Auto-Parser SQL**: Permite crear nuevas consultas en la API simplemente enviando la sentencia `SELECT ... FROM ...` pura o leyendo una vista física de Oracle.
* **Introspección en Vivo de Stored Procedures y Funciones**: La API descubre los parámetros `IN` y `OUT` consultando `ALL_ARGUMENTS` en tiempo real.
* **Carga Masiva de Archivos a Tablas Oracle**: Importación por lotes de archivos Excel (`.xlsx`, `.xls`) y delimitados (`.csv`, `.tsv`, `.txt`) a cualquier tabla de la base de datos con `executeMany`, introspección de columnas, auto-mapeo visual y rollback atómico.
* **100% Retrocompatible**: Conserva todos los nombres y endpoints históricos utilizados por los frontends existentes (`HojaIns`, `novHaberesDel`, `cargoIns`, `verifConcepto`, etc.).
* **Generación de Boletas PDF y Reportes XLSX**: Soporte para generación vectorial de recibos y exportación de planillas.
* **Procesamiento de Novedades IPSST**: Flujo en dos pasos con `uploadId` único y aislado para evitar colisiones concurrentes.
* **Developer & Admin Studio Integrado**: Interfaz visual moderna integrada en la propia API (`/admin`) con **API Explorer**, explorador interactivo de las 54 vistas, selector de columnas (`?fields=...`), creador SQL Studio en tiempo real, tester de Stored Procedures con binds dinámicos e importador masivo de Excel/CSV a Oracle.
* **Seguridad y Producción**: CORS configurable con whitelist, protección de endpoints de modificación y Frontend Studio mediante clave maestra (`ADMIN_ACCESS_KEY`), clave interna `X-Internal-Key` para llamadas desde Deno, y arquitectura de puerto único optimizada para proxy inverso HTTPS (Nginx/Caddy).

---

## 📋 Requisitos Previos

1. **Node.js**: Versión 18, 20 o superior.
2. **Oracle Instant Client (Recomendado para Máxima Compatibilidad)**: Versión 19c o 23c. Se recomienda para garantizar compatibilidad total con todas las versiones de Oracle (incluyendo Oracle 11g R2, 12c, 19c, 21c y 23c). La API cuenta además con fallback automático a Modo Thin.
3. **Oracle Database**: Compatible con Oracle 11g Release 2 (11.2.x), 12c, 19c, 21c o 23c.

---

## 🚀 Instalación y Puesta en Marcha

### 1. Clonar e Instalar Dependencias
```bash
git clone https://github.com/jferreyradev/node-apiliq.git
cd node-apiliq
npm install
```

### 2. Configurar Variables de Entorno (`.env`)
Crea o edita tu archivo `.env` en la raíz del proyecto:
```env
USERDB="US_SUELDO"
PASSWORD="TuPassword"
CONNECTIONSTRING="181.14.228.210:1521/desa"

PORT=3005
# ORACLE_CLIENT_LIB_DIR=./oracle-client/instantclient_23_3
LOGO_PATH=./assets/logo.png

# Clave maestra para Developer & Admin Studio y endpoints de modificación
ADMIN_ACCESS_KEY=admin_liq_2026
ENABLE_ADMIN_STUDIO=true

# Opcional: Clave interna para peticiones del puente Deno
REQUIRE_INTERNAL_KEY=false
API_INTERNAL_KEY=clave_secreta_desa

# Opcional: Whitelist CORS (separada por comas)
CORS_ORIGINS=http://localhost:3005,https://liq.midominio.com
```

### 3. Ejecutar los Scripts Iniciales en Oracle (Solo la primera vez)
En tu gestor de base de datos (**DBeaver**, **SQL Developer** o **PL/SQL Developer**) conectado como `US_SUELDO`:
1. Ejecuta [scripts/oracle_api_view_mapper.sql](scripts/oracle_api_view_mapper.sql) (Crea la tabla `API_VIEW_MAPPER` y los procedimientos de upsert).
2. Ejecuta [scripts/seed_views.sql](scripts/seed_views.sql) (Carga las 54 consultas iniciales).

### 4. Iniciar la Aplicación

#### En desarrollo:
```bash
npm start
```
*(Inicia con `nodemon` en el puerto `3005`).*

#### En producción:
```bash
pm2 start index.js --name "api_liquid"
pm2 save
```

---

## 💻 Developer & Admin Studio

La API incluye un estudio web integrado para desarrolladores y administradores accesible directamente en tu navegador:
👉 **`http://localhost:3005/admin`** *(o simplemente `http://localhost:3005/`)*

### 🛡️ Seguridad y Autenticación
Al ingresar, el estudio solicita la **Clave de Acceso de Administrador** configurada en `ADMIN_ACCESS_KEY` (`.env`).
* La autenticación utiliza comparación criptográfica en tiempo constante (`crypto.timingSafeEqual`) para prevenir ataques de temporización (timing attacks).
* Para llamadas vía API o curl, se envía en la cabecera `X-Admin-Key: <clave>` o `Authorization: Bearer <clave>`.
* Todos los endpoints de modificación de esquema (`/view/save`, `DELETE /view/:name`, `/view/refresh`) están protegidos con esta clave.

### 🎛️ Funcionalidades del Studio
1. **Explorador & Tester de Vistas**:
   * Buscador interactivo de las 54 consultas disponibles.
   * Generación automática de formularios con los filtros `WHERE` permitidos para cada vista.
   * Visualización de resultados en **Tabla Dinámica** y **JSON formateado**.
   * Medición de latencia de ejecución en milisegundos y conteo de registros devueltos.
   * Botón de desactivación de vistas obsoletas en `API_VIEW_MAPPER`.
2. **SQL Studio (Creador de Consultas con Auto-Parser)**:
   * Permite escribir consultas `SELECT ... FROM ... WHERE ...` en texto plano.
   * Vista previa sintáctica en vivo (detecta columnas, alias, cláusula `FROM` y parámetros bind).
   * Guardado directo en la base de datos `API_VIEW_MAPPER` y actualización inmediata en la memoria RAM sin reiniciar el servidor.
3. **Tester de Stored Procedures y Funciones**:
   * Descubre y lista automáticamente los procedimientos y funciones de los paquetes Oracle.
   * Formulario inteligente para parámetros `IN` (`NUMBER`, `VARCHAR2`, `DATE`).
   * Ejecución en vivo con visualización de cursores de salida o valores retornados.
4. **Cargador Masivo de Archivos a Tablas Oracle (`📁 Importar`)**:
   * Pestaña visual con arrastrar y soltar para archivos Excel (`.xlsx`, `.xls`) y delimitados (`.csv`, `.tsv`, `.txt`).
   * Previsualización instantánea de registros y selector de hojas de cálculo.
   * Detección automática y sugerencia de tablas destino existentes en Oracle.
   * Mapeo inteligente columna-a-columna (coincidencias por nombre y visualización de tipos Oracle `NUMBER`, `VARCHAR2`, `DATE`).
   * Opciones de vaciado previo (`TRUNCATE`) y modo transaccional atómico (`ROLLBACK` automático ante cualquier fila inválida).
5. **Recarga de Memoria RAM**:
   * Botón en la barra superior para reiniciar la caché de vistas y SPs en memoria sin reiniciar el proceso Node.js.
6. **Zero Dependencias & 100% Offline**:
   * SPA nativa sin frameworks externos ni CDNs de internet; funciona de manera completamente autónoma en redes municipales y VPNs cerradas.

---

## 📡 Referencia de Endpoints

### 1. Vistas y Consultas Dinámicas (`/api/view/*`)

| Método | Endpoint | Seguridad | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/view/list` | Pública | Retorna el catálogo completo de vistas activas. |
| `GET` | `/api/view/:name` | Pública | Ejecuta la vista con filtros, selección de columnas y paginación en la URL (`?Campo=valor&fields=Col1,Col2&limit=50&offset=0`). |
| `POST` | `/api/view/save` | `X-Admin-Key` | **Crea o actualiza una vista automáticamente** enviando un `SELECT` o vista Oracle. |
| `DELETE` | `/api/view/:name` | `X-Admin-Key` | Desactiva lógicamente la vista en `API_VIEW_MAPPER`. |
| `POST` | `/api/view/refresh` | `X-Admin-Key` | Reinicia la memoria RAM y recarga cambios desde Oracle. |
| `POST` | `/api/view/seed-from-file` | `X-Admin-Key` | Sincroniza todas las consultas del archivo local (`mapperViews.js` o `mapperViews.local.js`) a la BD Oracle. |
| `POST` | `/api/view/import-json` | `X-Admin-Key` | Importa y guarda un lote de vistas en formato JSON directamente en `API_VIEW_MAPPER`. |
| `POST` | `/api/admin/verify` | `X-Admin-Key` | Valida si la clave de administrador suministrada es correcta. |

#### Crear una consulta automáticamente desde un `SELECT`:
```bash
curl -X POST http://localhost:3005/api/view/save \
     -H "Content-Type: application/json" \
     -H "X-Admin-Key: admin_liq_2026" \
     -d '{
       "viewName": "empleadosPorRep",
       "sql": "SELECT p.idpers AS PersonaId, p.dni AS Documento, p.apellido || \x27, \x27 || p.nombre AS ApeNom, c.idrep AS IdRep FROM personas p INNER JOIN cargos c ON c.idpers = p.idpers WHERE c.idrep = :IdRep ORDER BY p.apellido"
     }'
```

#### Consumir la vista inmediatamente:
```bash
# Traer todas las columnas
curl "http://localhost:3005/api/view/empleadosPorRep?IdRep=1&limit=20"

# Recuperar únicamente ciertas columnas específicas (ahorro de ancho de banda y memoria)
curl "http://localhost:3005/api/view/empleadosPorRep?IdRep=1&fields=PersonaId,ApeNom,Documento&limit=20"
```

> **Nota sobre selección de columnas (`fields` / `columns`):**
> * Acepta nombres de campos separados por coma (ej. `fields=PersonaId,ApeNom`).
> * Es case-insensitive (acepta tanto `PersonaId` como `personaid`).
> * Valida estrictamente que los campos existan en el mapeo de la vista (devuelve `400 Bad Request` ante campos desconocidos).
> * Si se omite, retorna todas las columnas por defecto (100% retrocompatible).

---

### 2. Stored Procedures y Funciones (`/api/sp/*` y `/api/fn/*`)

La API introspecciona los parámetros `IN` y `OUT` en tiempo real desde Oracle.

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/sp/list` | Lista los procedimientos disponibles. |
| `POST` | `/api/sp/:name` | Ejecuta un SP enviando un JSON en el body. |
| `GET` | `/api/fn/list` | Lista las funciones disponibles. |
| `POST` | `/api/fn/:name` | Ejecuta una función y retorna `{ "value": resultado }`. |

#### Ejemplo de invocación de Stored Procedure:
```bash
curl -X POST http://localhost:3005/api/sp/hojaIns \
     -H "Content-Type: application/json" \
     -d '{
       "vIDREP": 1,
       "vORDEN": 10,
       "vPERIODO": 202603
     }'
```

---

### 3. Carga y Procesamiento de Novedades IPSST

Flujo en dos pasos protegido con `uploadId` concurrente:

1. **Subir archivo plano:**
   ```bash
   curl -X POST "http://localhost:3005/api/fileUpload" \
        -H "Content-Type: text/plain" \
        -H "x-file-name: novedades.txt" \
        --data-binary @novedades.txt
   ```
   *Respuesta:* `201 Created` con `{ "uploadId": "uuid-aqui" }`.

2. **Procesar novedades con el `uploadId`:**
   ```bash
   curl "http://localhost:3005/api/generaNovIPSST?uploadId=uuid-aqui"
   ```

---

### 4. Carga Masiva de Archivos a Tablas Oracle (`/api/import/*`)

Permite subir archivos **Excel (`.xlsx`, `.xls`)** o **Delimitados (`.csv`, `.tsv`, `.txt`)** e insertarlos masivamente por lotes en cualquier tabla de Oracle (ej. tablas de staging / intermedias para posterior procesamiento por SP):

| Método | Endpoint | Seguridad | Descripción |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/import/preview` | `X-Admin-Key` | Parsea el archivo en memoria, detecta hojas, columnas y retorna muestra previa con `uploadId`. |
| `GET` | `/api/import/tables` | `X-Admin-Key` | Lista las tablas disponibles en Oracle. |
| `GET` | `/api/import/table-columns/:table` | `X-Admin-Key` | Retorna los nombres y tipos de datos de las columnas de la tabla. |
| `POST` | `/api/import/execute` | `X-Admin-Key` | Ejecuta la inserción masiva (`executeMany`) con el mapeo de columnas elegido. |
| `POST` | `/api/import/direct` | `X-Admin-Key` | **Carga directa en 1 solo paso** con auto-mapeo de columnas (ideal para scripts y curl). |

#### Ejemplo de carga directa en 1 solo comando (curl):
```bash
curl -X POST http://localhost:3005/api/import/direct \
     -H "X-Admin-Key: admin_liq_2026" \
     -H "Content-Type: application/octet-stream" \
     -H "X-Table-Name: STG_NOVEDADES" \
     -H "X-Truncate: true" \
     -H "X-Atomic: true" \
     -H "X-File-Name: novedades_marzo.xlsx" \
     --data-binary @novedades_marzo.xlsx
```

*(También se puede utilizar interactivamente con arrastrar y soltar desde el **Developer & Admin Studio** en la pestaña `📁 Importar`).*

---

### 5. Recibos de Sueldo en PDF y Reportes Excel

- **Boleta PDF:** `GET /api/boleta?Periodo=202603&IdRep=1&Orden=10`
- **Reporte Excel:** `GET /api/xlsx/resumenLiq?Periodo=202603`
- **Reporte TXT:** `GET /api/txt/archivoIPSST?Periodo=202603`

---

## 🛠️ Herramientas y Scripts Útiles

* **Generador de Vistas por Terminal (`scripts/create_view.js`):**
  Genera el bloque PL/SQL listo para ejecutar en DBeaver a partir de cualquier consulta SQL:
  ```bash
  node scripts/create_view.js --name miConsulta "SELECT p.idpers AS PersonaId, p.dni FROM personas p"
  ```
* **Introspección y Generación de Mappers (`scripts/generate_mappers.js`):**
  Inspecciona paquetes de Oracle y genera los archivos de mapeo:
  ```bash
  node scripts/generate_mappers.js MOD_NOV
  ```

---

## 🧪 Pruebas Automatizadas

El proyecto cuenta con una suite completa de pruebas unitarias y de integración que se ejecutan sin requerir conexión a base de datos externa:

```bash
npm test
```

---

## 📖 Documentación Detallada

Para consultar la guía técnica completa de arquitectura, compatibilidad con Oracle 11g y resolución de problemas, consulta:
> 📄 [docs/guia_migracion_vistas_oracle.md](docs/guia_migracion_vistas_oracle.md)
