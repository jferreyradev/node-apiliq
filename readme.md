# API REST Sueldos (api_liquid / node-apiliq)

API REST robusta construida con **Node.js, Express y Oracle Database (11g/12c/19c)** para la gestión y liquidación de sueldos municipales, generación de boletas PDF, reportes Excel/TXT, intercambio de novedades IPSST y ejecución dinámica de procedimientos y consultas.

---

## 🌟 Características Principales

* **Arquitectura Dinámica Zero-Config**: Se prescinde de la edición manual de archivos de mapeo en tiempo de ejecución.
* **Catálogo de Consultas en Base de Datos**: Las vistas y consultas residen en la tabla `API_VIEW_MAPPER` con recarga en memoria RAM (0 ms de latencia) y fallback automático.
* **Auto-Parser SQL**: Permite crear nuevas consultas en la API simplemente enviando la sentencia `SELECT ... FROM ...` pura o leyendo una vista física de Oracle.
* **Introspección en Vivo de Stored Procedures y Funciones**: La API descubre los parámetros `IN` y `OUT` consultando `ALL_ARGUMENTS` en tiempo real.
* **100% Retrocompatible**: Conserva todos los nombres y endpoints históricos utilizados por los frontends existentes (`HojaIns`, `novHaberesDel`, `cargoIns`, `verifConcepto`, etc.).
* **Generación de Boletas PDF y Reportes XLSX**: Soporte para generación vectorial de recibos y exportación de planillas.
* **Procesamiento de Novedades IPSST**: Flujo en dos pasos con `uploadId` único y aislado para evitar colisiones concurrentes.
* **Seguridad y Producción**: CORS configurable con whitelist, protección de cabecera interna `X-Internal-Key` para llamadas desde Deno, y soporte HTTPS con TLS.

---

## 📋 Requisitos Previos

1. **Node.js**: Versión 18, 20 o superior.
2. **Oracle Instant Client**: Versión 19c o 23c (configurado en `ORACLE_CLIENT_LIB_DIR`).
3. **Oracle Database**: Compatible con Oracle 11g Release 2 (11.2.x), 12c, 19c o 21c.

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

HTTP_PORT=3005
HTTPS_PORT=3007
ENABLE_HTTPS=false

ORACLE_CLIENT_LIB_DIR=./oracle-client/instantclient_23_3
LOGO_PATH=./assets/logo.png

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

## 📡 Referencia de Endpoints

### 1. Vistas y Consultas Dinámicas (`/api/view/*`)

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/view/list` | Retorna el catálogo completo de vistas activas. |
| `GET` | `/api/view/:name` | Ejecuta la vista con filtros y paginación en la URL (`?Campo=valor&limit=50&offset=0`). |
| `POST` | `/api/view/save` | **Crea o actualiza una vista automáticamente** enviando un `SELECT` o vista Oracle. |
| `DELETE` | `/api/view/:name` | Desactiva lógicamente la vista en `API_VIEW_MAPPER`. |
| `POST` | `/api/view/refresh` | Reinicia la memoria RAM y recarga cambios desde Oracle. |

#### Crear una consulta automáticamente desde un `SELECT`:
```bash
curl -X POST http://localhost:3005/api/view/save \
     -H "Content-Type: application/json" \
     -d '{
       "viewName": "empleadosPorRep",
       "sql": "SELECT p.idpers AS PersonaId, p.dni AS Documento, p.apellido || \x27, \x27 || p.nombre AS ApeNom, c.idrep AS IdRep FROM personas p INNER JOIN cargos c ON c.idpers = p.idpers WHERE c.idrep = :IdRep ORDER BY p.apellido"
     }'
```

#### Consumir la vista inmediatamente:
```bash
curl "http://localhost:3005/api/view/empleadosPorRep?IdRep=1&limit=20"
```

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

### 4. Recibos de Sueldo en PDF y Reportes Excel

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
