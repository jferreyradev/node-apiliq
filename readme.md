# API REST Sueldos (api_liquid / node-apiliq)

API REST robusta construida con **Node.js, Express y Oracle Database (11g/12c/19c)** para la gestión y liquidación de sueldos municipales, generación de boletas PDF, reportes Excel/TXT, intercambio de novedades IPSST y ejecución dinámica de procedimientos y consultas.

> 📚 **Documentación y Guías Operativas:**
> * 🖥️ **[Manual Operativo: Instalación, Actualización y Logs (Windows / Linux)](docs/GUIA_OPERATIVA_DESPLIEGUE_Y_LOGS.md)** — *Guía paso a paso para instaladores (NSSM, Servicios Windows, PM2, Systemd).*
> * 🏛️ **[Justificación Técnica y Defensa Arquitectónica](docs/JUSTIFICACION_TECNICA_ARQUITECTURA.md)** — *Documento formal para directores y comités técnicos (por qué Node.js supera a PHP y métricas).*
> * 🍓 **[Instructivo: Despliegue en Raspberry Pi con Cloudflare Tunnel](docs/INSTRUCTIVO_DESPLIEGUE_RASPBERRY_PI_CLOUDFLARE.md)** — *Aislamiento total de Oracle en red local con salida HTTPS segura.*
> * 🚀 **[Puesta en Marcha Rápida (PUESTA_EN_MARCHA.md)](PUESTA_EN_MARCHA.md)** — *Instrucciones rápidas de instalación inicial.*

---

## 🌟 Características Principales

* **Arquitectura Dinámica Zero-Config**: Se prescinde de la edición manual de archivos de mapeo en tiempo de ejecución; las vistas y Stored Procedures se administran sobre la tabla `API_VIEW_MAPPER` y el diccionario `ALL_ARGUMENTS` en tiempo real.
* **Compresión HTTP Dinámica y Transparente**: Middleware nativo Gzip que reduce el tamaño del JSON hasta en un 85% sobre enlaces VPN municipales.
* **Trazabilidad con `X-Request-Id`**: Cada petición cuenta con un UUID único propagado en headers y logs de error para auditorías instantáneas.
* **Telemetría y Estado del Pool en Tiempo Real**: Endpoint protegido `GET /api/admin/pool-status` para monitorear conexiones abiertas y en uso en Oracle.
* **Cierre Suave (*Graceful Shutdown*)**: Drenado ordenado de 10 segundos en el pool de Oracle para evitar transacciones huérfanas al reiniciar el servidor.
* **Catálogo de Consultas en Base de Datos**: Vistas cacheadas en memoria RAM (latencia 0 ms) con sincronización en caliente y fallback pasivo.
* **Carga Masiva de Archivos a Tablas Oracle**: Importación por lotes de archivos Excel (`.xlsx`, `.xls`) y delimitados (`.csv`, `.tsv`, `.txt`) con `executeMany` (2.000 filas por lote) y rollback atómico.
* **100% Retrocompatible**: Conserva todos los nombres y endpoints históricos utilizados por los frontends (`liq-panel` en Vue 3 y `dno-admin-bridge` en Deno).
* **Suite de 107 Tests Automatizados**: Ejecución en menos de 2 segundos mediante `npm test` con 0 dependencias externas de testing.

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
Crea tu archivo `.env` en la raíz del proyecto con la configuración esencial:
```env
USERDB="<USUARIO_ORACLE>"
PASSWORD="<PASSWORD_ORACLE>"
CONNECTIONSTRING="<HOST_ORACLE>:<PUERTO>/<SERVICIO>"

ADMIN_ACCESS_KEY="<TU_CLAVE_ADMIN_AQUI>"
PORT=3005

# Opcional (solo si Instant Client está en una carpeta local personalizada):
# ORACLE_CLIENT_LIB_DIR=./oracle-client/instantclient_23_3
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

## 💻 Consola de Administración Multi-Host (`liq-admin-studio`)

La gestión visual del catálogo de vistas, SQL Studio, Stored Procedures, API Explorer e Importador Excel/CSV se realiza mediante el frontend desacoplado **`liq-admin-studio`** (Vue 3 + Vite), capaz de conectarse tanto a `http://localhost:3005` como a múltiples municipios a través de la pasarela Deno Bridge.

### 🛡️ Seguridad y Autenticación
* La autenticación administrativa utiliza comparación criptográfica en tiempo constante (`crypto.timingSafeEqual`) mediante la variable `ADMIN_ACCESS_KEY` (`.env`).
* Para llamadas vía API o `curl`, se envía en la cabecera `X-Admin-Key: <clave>` o `Authorization: Bearer <clave>`.
* Todos los endpoints de modificación de esquema (`/api/view/save`, `DELETE /api/view/:name`, `/api/view/refresh`, `/api/view/import-json`, `/api/sp/import-json`, `/api/sp/sync-oracle`, `/api/import/*`) están protegidos con esta clave.

---

## 📅 Regla de Dominio Obligatoria para Períodos (Siempre Día `01`)

Para trabajar con cualquier endpoint de esta API, **el día del período es siempre `01`** y **solamente cambian el mes y el año**:
* **En Vistas y Consultas (`GET /api/view/:name`)**: Todo filtro de período (`Periodo`, `PeriodoLiq`, `vPERIODO`, `vPER`) se normaliza automáticamente a `'01/MM/YYYY'` (ej. `'01/09/2026'`), sin importar si se envía `'09/2026'`, `'2026-09'`, `'202609'` o `'15/09/2026'`.
* **En Stored Procedures y Funciones (`POST /api/sp/:name`, `POST /api/fn/:name`)**: Todo parámetro de período se vincula como objeto `Date` en medianoche de hora local en el **día 1 del mes** (`01/MM/YYYY 00:00:00` local), evitando desfases de zona horaria UTC-3 con el tipo `DATE` de Oracle.

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
     -H "X-Admin-Key: <TU_CLAVE_ADMIN>" \
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

La API unifica el catálogo completo (715+ procedimientos generados + históricos legacy + personalizados locales) e introspecciona los parámetros `IN` y `OUT` en tiempo real desde Oracle (`ALL_ARGUMENTS`).

| Método | Endpoint | Seguridad | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/sp/list` | Pública | Lista todos los procedimientos disponibles (permite descargarlos a JSON desde el Studio). |
| `POST` | `/api/sp/:name` | Pública | Ejecuta un SP enviando un JSON en el body. |
| `POST` | `/api/sp/import-json` | `X-Admin-Key` | Importa un lote JSON de SPs y/o Funciones en la caché RAM y en `config/spmapper.local.json`. |
| `POST` | `/api/sp/sync-oracle` | `X-Admin-Key` | Introspecciona `ALL_ARGUMENTS` en Oracle en vivo y actualiza el catálogo de SPs y Funciones. |
| `GET` | `/api/fn/list` | Pública | Lista todas las funciones disponibles. |
| `POST` | `/api/fn/:name` | Pública | Ejecuta una función y retorna `{ "value": resultado }`. |
| `POST` | `/api/fn/import-json` | `X-Admin-Key` | Importa definiciones JSON de funciones en caché RAM y `config/fnmapper.local.json`. |

#### Ejemplo de invocación de Stored Procedure:
```bash
curl -X POST http://localhost:3005/api/sp/hojaIns \
     -H "Content-Type: application/json" \
     -d '{
       "vIDREP": 1,
       "vORDEN": 10,
       "vPERIODO": "01/03/2026"
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
     -H "X-Admin-Key: <TU_CLAVE_ADMIN>" \
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
