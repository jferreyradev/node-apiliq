# 🚀 Guía Rápida de Puesta en Marcha

Guía práctica para desplegar e iniciar **API REST Sueldos (`node-apiliq`)** en un servidor nuevo (Linux Ubuntu/Debian/RHEL, macOS o Windows) de forma rápida y sin complicaciones.

---

## 📌 1. Requisitos Previos

1. **Node.js**: Versión **18.x**, **20.x LTS** o superior (`node -v`).
2. **Git**: Para clonar el repositorio (`git --version`).
3. **Oracle Instant Client (Recomendado para Máxima Compatibilidad)**:
   > 💡 **Recomendación:** Se sugiere fuertemente instalar **Oracle Instant Client (19c o 23c)**. Esto habilita el **Modo Thick** de Oracle, garantizando compatibilidad total con cualquier versión de base de datos (incluyendo Oracle 11g R2, 12c, 19c, 21c y 23c) y evitando problemas de autenticación o protocolos de red. *(La API cuenta con fallback automático a Modo Thin en 12c+, pero Instant Client es la opción recomendada para estabilidad productiva).*
4. **Conectividad a Oracle**: Acceso al host y puerto de la base de datos (por defecto `1521`):
   ```bash
   nc -zv <HOST_ORACLE> 1521  # o telnet <HOST_ORACLE> 1521
   ```
5. **Usuario en Oracle**: Esquema asignado (ej. `US_SUELDO`) con permisos para crear tablas, vistas y secuencias, y permisos `SELECT` sobre `ALL_ARGUMENTS` y `ALL_TAB_COLUMNS`.

---

## 📥 2. Instalación Paso a Paso

### Paso 1: Clonar el Repositorio
```bash
git clone https://github.com/jferreyradev/node-apiliq.git
cd node-apiliq
```

### Paso 2: Instalar Dependencias
```bash
npm install --omit=dev  # En producción
# o 'npm install' en desarrollo
```

### Paso 3: Instalar Oracle Instant Client (Recomendado)

Elige la opción adecuada para tu sistema operativo:

#### Opción A: En Linux (Ubuntu / Debian)
```bash
sudo apt-get update && sudo apt-get install -y libaio1
sudo mkdir -p /opt/oracle && cd /opt/oracle
sudo wget https://download.oracle.com/otn_software/linux/instantclient/2340000/instantclient-basic-linux.x64-23.4.0.24.05.zip
sudo unzip instantclient-basic-linux.x64-23.4.0.24.05.zip
sudo sh -c "echo /opt/oracle/instantclient_23_4 > /etc/ld.so.conf.d/oracle-instantclient.conf"
sudo ldconfig
```

#### Opción B: En Linux (RHEL / CentOS / Rocky Linux)
```bash
sudo yum install -y libaio
sudo mkdir -p /opt/oracle && cd /opt/oracle
sudo wget https://download.oracle.com/otn_software/linux/instantclient/2340000/instantclient-basic-linux.x64-23.4.0.24.05.zip
sudo unzip instantclient-basic-linux.x64-23.4.0.24.05.zip
sudo sh -c "echo /opt/oracle/instantclient_23_4 > /etc/ld.so.conf.d/oracle-instantclient.conf"
sudo ldconfig
```

#### Opción C: Carpeta Local (macOS, Windows o sin permisos root)
Descomprime Instant Client dentro del proyecto en `./oracle-client/instantclient_23_3` o indica la ruta absoluta en la variable `ORACLE_CLIENT_LIB_DIR` de tu `.env`.

#### Verificar la detección del cliente:
```bash
node scripts/test-oracle-client.js
```
*(Debe reportar `✅ Oracle Client (Modo Thick) cargado correctamente`).*

---

### Paso 4: Configurar Variables de Entorno (`.env`)

Copia la plantilla y configura tus credenciales:
```bash
cp .env.example .env
nano .env
```

Parámetros principales:
```env
USERDB="US_SUELDO"
PASSWORD="TuPasswordSegura"
CONNECTIONSTRING="192.168.1.50:1521/ORCL"

ADMIN_ACCESS_KEY="admin_liq_2026"
PORT=3005

# Solo si el Instant Client está en una carpeta personalizada:
# ORACLE_CLIENT_LIB_DIR="/opt/oracle/instantclient_23_4"
```

---

### Paso 5: Crear los Objetos Base en Oracle (Solo la 1ª vez)

Conéctate con tu cliente SQL preferido (DBeaver, SQL Developer, PL/SQL Developer o sqlplus) como el usuario configurado y ejecuta:

```sql
@scripts/oracle_api_view_mapper.sql
```
*(Crea la tabla `API_VIEW_MAPPER`, la secuencia y los procedimientos de upsert).*

**Poblar las consultas maestras:**
* **Desde el navegador:** Inicia la API, ingresa a `http://localhost:3005/admin` y presiona **`📥 Sincronizar mapperViews a BD`**.
* **O desde SQL:** Ejecuta `@scripts/seed_views.sql`.

---

### Paso 6: Validar con la Suite de Tests

```bash
npm test
```
**Resultado esperado:**
```text
ℹ tests 86
ℹ suites 0
ℹ pass 85
ℹ fail 0
ℹ skipped 1
```
*(Si los 85 tests unitarios pasan en verde, el entorno está 100% verificado y compatible).*

---

## 🖥️ 3. Puesta en Marcha

### En Desarrollo:
```bash
npm start
```
La API escuchará en `http://localhost:3005/api` y el Admin Studio en `http://localhost:3005/admin`.

### En Producción con PM2 (Recomendado):
```bash
sudo npm install -g pm2
pm2 start index.js --name "api_liquid"
pm2 save
pm2 startup
```

---

## 🌐 4. Verificación y Admin Studio

1. **Healthcheck HTTP:**
   ```bash
   curl http://localhost:3005/api/admin/health
   ```
2. **Developer & Admin Studio:**
   Ingresa en tu navegador a: **`http://<IP_SERVIDOR>:3005/admin`** (ingresa la clave `ADMIN_ACCESS_KEY`):
   * **🌐 API Explorer:** Catálogo interactivo de endpoints, selector de campos (`?fields=...`), filtros dinámicos y generador de cURL.
   * **📋 Vistas:** Consulta y prueba directa de las consultas maestras con paginación nativa.
   * **➕ SQL Studio:** Creación de nuevas consultas dinámicas vía SQL y exportación/importación JSON.
   * **⚡ SPs:** Ejecución e introspección de Stored Procedures y Funciones PL/SQL.
   * **📁 Importar:** Carga masiva de planillas Excel/CSV a tablas Oracle con mapeo visual.

---

## 🔒 5. Proxy Inverso con Nginx (Producción con SSL)

En producción, Nginx gestiona la terminación HTTPS y reenvía el tráfico al puerto HTTP único de la API:

```nginx
server {
    listen 80;
    server_name sueldos-api.tudominio.gob.ar;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name sueldos-api.tudominio.gob.ar;

    ssl_certificate /etc/letsencrypt/live/sueldos-api.tudominio.gob.ar/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sueldos-api.tudominio.gob.ar/privkey.pem;

    client_max_body_size 50M; # Permitir subida de archivos Excel/CSV

    location / {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

---

## 🏢 6. Despliegues Multi-Cliente con Vistas Personalizadas

Para servidores con consultas específicas por cliente o municipio:
* **Archivo local desacoplado:** Guarda las consultas particulares en `config/mapperViews.local.js` (ignorado en `.gitignore` para evitar conflictos con `git pull`). Luego presiona **`📥 Sincronizar archivo local a BD`** en `/admin`.
* **Exportar e Importar JSON:** Desde **SQL Studio** puedes exportar las consultas a un archivo `.json` o subirlas a otro servidor directamente desde el navegador sin usar SSH.

---

## 🛠️ 7. Resolución de Problemas Frecuentes

| Error | Causa | Solución |
| :--- | :--- | :--- |
| `DPI-1047: Cannot locate a 64-bit Oracle Client library` | Falta `libaio` o librerías de Instant Client no encontradas. | En Linux: `sudo apt-get install -y libaio1`. Si usas carpeta local, verifica `ORACLE_CLIENT_LIB_DIR` en `.env`. Corre `node scripts/test-oracle-client.js`. |
| `ORA-12541` / `ORA-12170: Connect timeout` | Host o puerto de Oracle inalcanzable. | Verifica conectividad: `nc -zv <HOST> 1521` o comprueba si se requiere VPN municipal. |
| `ORA-01017: invalid username/password` | Credenciales incorrectas. | Revisa `USERDB` y `PASSWORD` en `.env` (asegúrate de que no tengan espacios extra). |
| `401 Unauthorized` en `/admin` o importación | Clave administrativa inválida. | Verifica que coincida con `ADMIN_ACCESS_KEY` en tu `.env`. |
| `413 Payload Too Large` al subir Excel | Límite de subida en proxy. | Agrega `client_max_body_size 50M;` en la configuración de Nginx y recarga el servicio. |

---

## 📞 Soporte y Referencia
* **Repositorio:** [https://github.com/jferreyradev/node-apiliq](https://github.com/jferreyradev/node-apiliq)
* **Documentación completa de endpoints:** Consulta [`README.md`](README.md).
