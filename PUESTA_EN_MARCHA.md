# 🚀 Guía Rápida de Puesta en Marcha (Instalación por Terceros)

Esta guía describe el procedimiento paso a paso para desplegar e iniciar **API REST Sueldos (`api_liquid` / `node-apiliq`)** en un servidor nuevo (Linux Ubuntu/Debian/RHEL, macOS o Windows Server) de forma rápida y sin complicaciones.

---

## 📌 1. Requisitos Previos del Servidor

Asegúrate de contar con los siguientes elementos antes de comenzar:

1. **Node.js**: Versión **18.x**, **20.x LTS** o superior.
   * Verificar en terminal: `node -v` y `npm -v`
2. **Git**: Para clonar el repositorio (`git --version`).
3. **Oracle Instant Client (OPCIONAL)**:
   * **Modo Thin (Puro JavaScript - Por Defecto)**: Si la base de datos es **Oracle 12c, 18c, 19c, 21c o 23c**, **NO necesitas instalar Oracle Instant Client**. La API funciona directamente sin binarios nativos ni librerías de sistema adicionales.
   * **Modo Thick (Binarios Nativos)**: **Únicamente obligatorio** si te conectas a una base de datos **Oracle 11g Release 2 (11.2.x)**, debido a que 11g utiliza algoritmos de autenticación y red heredados que solo soporta la librería cliente C de Oracle.
4. **Acceso de Red a Oracle**: Conectividad al host y puerto de la base de datos (por defecto `1521`).
   * Probar conectividad: `nc -zv <IP_ORACLE> 1521` o `telnet <IP_ORACLE> 1521`.
5. **Usuario en Oracle con Privilegios**: Generalmente `US_SUELDO` (debe tener permisos para crear tablas, vistas y secuencias, y permisos `SELECT` sobre `ALL_ARGUMENTS` y `ALL_TAB_COLUMNS`).

---

## 📥 2. Paso a Paso de Instalación

### Paso 1: Clonar el Repositorio
```bash
git clone https://github.com/jferreyradev/node-apiliq.git
cd node-apiliq
```

### Paso 2: Instalar Dependencias de Node.js
```bash
npm install
```
*(Si estás en un servidor de producción estricto puedes usar `npm install --omit=dev`).*

---

### Paso 3: ¿Cuándo configurar Oracle Instant Client? (Opcional)

> 💡 **¿Tu base de datos es Oracle 12c, 18c, 19c, 21c o 23c?**
> **¡PUEDES SALTEARTE ESTE PASO!**
> La librería `node-oracledb` 7.x incluye un controlador nativo en **Modo Thin (100% JavaScript)**. No necesitas descargar archivos `.zip`, ni instalar `libaio`, ni compilar librerías nativas, ni configurar `LD_LIBRARY_PATH`. La API se conectará directamente a la base de datos sin requerir ningún cliente binario instalado.

#### ¿Cuándo sí es necesario configurar Instant Client?
Únicamente si la base de datos a la que te conectas es **Oracle 11g Release 2 (11.2.x)**. En ese caso se requiere habilitar **Modo Thick** proveyendo las librerías binarias de Oracle Instant Client (versión 19c o 23c):

#### Opción A: En Linux (Ubuntu / Debian / CentOS / RHEL)
1. Instalar la librería del sistema `libaio`:
   ```bash
   # Ubuntu / Debian:
   sudo apt-get update && sudo apt-get install -y libaio1

   # RHEL / CentOS / Rocky Linux:
   sudo yum install -y libaio
   ```
2. Descargar y descomprimir Oracle Instant Client (por ejemplo en `/opt/oracle`):
   ```bash
   sudo mkdir -p /opt/oracle
   cd /opt/oracle
   sudo wget https://download.oracle.com/otn_software/linux/instantclient/2340000/instantclient-basic-linux.x64-23.4.0.24.05.zip
   sudo unzip instantclient-basic-linux.x64-23.4.0.24.05.zip
   ```
3. Agregar la ruta al cargador dinámico de librerías:
   ```bash
   sudo sh -c "echo /opt/oracle/instantclient_23_4 > /etc/ld.so.conf.d/oracle-instantclient.conf"
   sudo ldconfig
   ```

#### Opción B: En macOS o Carpeta Local del Proyecto
Si prefieres colocar el cliente dentro del propio proyecto sin tocar el sistema operativo:
1. Descomprime Instant Client dentro de `./oracle-client/instantclient_23_3`.
2. Indica la ruta en la variable `ORACLE_CLIENT_LIB_DIR` de tu `.env` (ver Paso 4).

#### Diagnóstico del Modo de Conexión:
Ejecuta el script de diagnóstico incluido para verificar el estado:
```bash
node scripts/test-oracle-client.js
```
- **Si detecta Instant Client:** Informará `Oracle Client (Thick Mode) cargado correctamente` (apto para todas las versiones, incluyendo 11g).
- **Si no detecta Instant Client:** Informará `Modo Thin (Puro JavaScript) ACTIVO` (listo para 12c, 19c, 21c, 23c).

---

### Paso 4: Configurar Variables de Entorno (`.env`)

Copia la plantilla de ejemplo y edita tus credenciales:
```bash
cp .env.example .env
nano .env   # o usa tu editor favorito (vim, code, etc.)
```

#### Parámetros Clave en `.env`:

| Variable | Valor de Ejemplo | Descripción |
| :--- | :--- | :--- |
| `USERDB` | `US_SUELDO` | Usuario del esquema de Oracle. |
| `PASSWORD` | `MiClaveSegura2026` | Contraseña del usuario Oracle. |
| `CONNECTIONSTRING` | `192.168.1.50:1521/ORCL` | Cadena de conexión TNS (`host:puerto/servicio` o `TNS_ALIAS`). |
| `PORT` | `3005` | Puerto único HTTP en el que escucha la API (también soporta `HTTP_PORT`). En producción con SSL se usa un reverse proxy (Nginx). |
| `ADMIN_ACCESS_KEY` | `admin_liq_2026` | **Clave maestra** para ingresar a `/admin` y autorizar importaciones/guardados. |
| `ENABLE_ADMIN_STUDIO`| `true` | Habilita el Admin Studio visual en `/admin`. |
| `ORACLE_CLIENT_LIB_DIR`| *(Comentado)* | Solo necesario si te conectas a Oracle 11g y el Instant Client está en una carpeta local no estándar. En Modo Thin (Oracle 12c+) déjalo comentado. |
| `DB_QUEUE_TIMEOUT` | `10000` | Tiempo máximo de espera en cola de BD (10 seg) para evitar congelamientos. |

---

### Paso 5: Crear los Objetos Base en Oracle (Solo la 1ª vez)

Para que el catálogo dinámico de vistas, el importador de archivos y el creador automático de consultas funcionen, se deben crear los objetos base en Oracle.

Conéctate con tu herramienta de BD (**SQL Developer**, **DBeaver** o `sqlplus`) como el usuario configurado (`US_SUELDO`) y ejecuta:

```sql
@scripts/oracle_api_view_mapper.sql
```
*(Crea la tabla `API_VIEW_MAPPER`, la secuencia `API_VIEW_MAPPER_SEQ` y los procedimientos almacenados de upsert seguro).*

#### ¿Cómo poblar las 54 consultas maestras? (Elige una opción):
* **Opción A (Recomendada - Con 1 solo clic desde el navegador):**
  Una vez que inicies la API (Paso 3 o 4), ingresa al Admin Studio (`http://<servidor>:3005/admin`) y presiona el botón **`📥 Sincronizar mapperViews a BD`**. La API leerá el archivo local y poblará la tabla en Oracle en menos de 2 segundos.
* **Opción B (Desde tu cliente SQL):**
  Si prefieres poblarla antes de levantar la API, ejecuta en tu cliente SQL:
  ```sql
  @scripts/seed_views.sql
  ```

---

### Paso 6: Validar la Instalación con la Suite de Tests

Antes de poner en marcha el servicio en producción, corre la suite de pruebas automatizadas:
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
*(El test marcado como skipped corresponde al test de integración contra base de datos Oracle real, el cual se ejecuta opcionalmente mediante `RUN_INTEGRATION=1 npm test`).*
*Si los 85 tests unitarios pasan en verde, el entorno está 100% verificado, listo y compatible.*

---

## 🖥️ 3. Puesta en Marcha del Servicio

### Modo A: Desarrollo o Pruebas Rápidas
```bash
npm start
```
La API iniciará en modo escucha en `http://localhost:3005`.

---

### Modo B: Producción con PM2 (Recomendado)

PM2 mantiene el servicio corriendo en segundo plano, lo reinicia automáticamente en caso de fallos y lo levanta al reiniciar el servidor.

1. **Instalar PM2 globalmente:**
   ```bash
   sudo npm install -g pm2
   ```

2. **Iniciar la API:**
   ```bash
   pm2 start index.js --name "api_liquid"
   ```

3. **Verificar estado y logs:**
   ```bash
   pm2 status
   pm2 logs api_liquid
   ```

4. **Configurar inicio automático con el sistema:**
   ```bash
   pm2 save
   pm2 startup
   ```
   *(Copia y ejecuta el comando que PM2 imprima en pantalla).*

---

### Modo C: Producción con Servicio Systemd (Linux)

Si prefieres administrarlo como servicio nativo de Linux:

1. Crear el archivo de servicio:
   ```bash
   sudo nano /etc/systemd/system/api_liquid.service
   ```

2. Pegar la siguiente configuración (ajusta las rutas según tu servidor):
   ```ini
   [Unit]
   Description=API REST Liquidacion de Sueldos (api_liquid)
   After=network.target

   [Service]
   Type=simple
   User=ubuntu
   WorkingDirectory=/home/ubuntu/node-apiliq
   EnvironmentFile=/home/ubuntu/node-apiliq/.env
   ExecStart=/usr/bin/node index.js
   Restart=always
   RestartSec=5
   StandardOutput=syslog
   StandardError=syslog
   SyslogIdentifier=api_liquid

   [Install]
   WantedBy=multi-user.target
   ```

3. Habilitar e iniciar el servicio:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable api_liquid
   sudo systemctl start api_liquid
   sudo systemctl status api_liquid
   ```

---

## 🌐 4. Verificación y Primer Acceso

### 1. Probar el Healthcheck por HTTP:
```bash
curl http://localhost:3005/api/admin/health
```
**Respuesta esperada:**
```json
{
  "api": "online",
  "version": "1.0.0",
  "database": {
    "connected": true,
    "user": "US_SUELDO",
    "connectionString": "..."
  }
}
```

### 2. Ingresar al Developer & Admin Studio:
Abre en tu navegador:
👉 **`http://<IP_O_DOMINIO_DEL_SERVIDOR>:3005/admin`**

1. Ingresa la clave maestra configurada en `ADMIN_ACCESS_KEY`.
2. Observa el indicador en la esquina superior derecha:
   - `DB: Conectado`: La conexión a Oracle está activa y lista.
3. Explora las pestañas interactivas:
   - **🌐 API Explorer (¡Nuevo!):** Catálogo interactivo de todos los endpoints de la API (`/api/view/*`, `/api/sp/*`, `/api/fn/*`).
     - **Inspección en tiempo real:** Visualiza la ruta, método HTTP y descripción de cada endpoint.
     - **Proyección de Columnas Selectiva (`fields`):** Puedes marcar y elegir qué columnas específicas consultar vía query param `?fields=Columna1,Columna2` para optimizar payloads y rendimiento de red.
     - **Filtros y Paginación:** Configura parámetros de búsqueda, `limit` y `offset` dinámicamente.
     - **Acciones Rápidas:** Copia la URL completa del endpoint, copia el comando `cURL` listo para terminal/scripts, o presiona **Ejecutar Consulta** para previsualizar los datos en vivo.
   - **📋 Vistas:** Listado, inspección y prueba directa de las consultas maestras configuradas en el mapper, con paginación `ROWNUM` nativa para Oracle.
   - **➕ SQL Studio:** Permite crear nuevas vistas al vuelo simplemente enviando una sentencia SQL `SELECT`. Incluye botones para **Exportar vistas a JSON** y **Subir/Importar vistas JSON a BD** para migrar o respaldar configuraciones entre servidores sin consola.
   - **⚡ SPs:** Introspección y ejecución interactiva de Stored Procedures y Funciones PL/SQL con detección automática de argumentos `IN`, `OUT` y cursores en tiempo real.
   - **📁 Importar:** Carga masiva de planillas Excel (`.xlsx`, `.xls`) o CSV directamente a cualquier tabla de Oracle, con previsualización de datos, mapeo visual de columnas e inserción por lotes (`executeMany`) con opción atómica (`commit`/`rollback`).

---

## 🔒 5. Configuración de Proxy Inverso con Nginx (Opcional)

Si vas a publicar la API hacia una red externa o internet mediante HTTPS con certificado SSL (Let's Encrypt o corporativo), utiliza este bloque de configuración en Nginx:

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

    # IMPORTANTE: Permitir subida de archivos Excel/CSV de hasta 50MB
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts para consultas o cargas pesadas
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }
}
```

---

## 🏢 7. Despliegue en Múltiples Servidores con Vistas Personalizadas

Si administras múltiples instalaciones de la API (por ejemplo, 4 servidores para distintos municipios o dependencias) donde cada uno tiene consultas o campos ligeramente diferentes en `mapperViews`:

### Principio de Aislamiento:
* **Cada base de datos Oracle es soberana:** La tabla `API_VIEW_MAPPER` reside en la base de datos de cada cliente. Si una consulta está registrada en la BD, la API usará esa versión y no la del archivo genérico.

### Estrategia A: Archivo Local Desacoplado (`config/mapperViews.local.js`)
Para evitar conflictos con Git al actualizar el código con `git pull origin main`:
1. En el servidor del cliente específico, guarda sus consultas personalizadas como:
   ```text
   config/mapperViews.local.js   (o config/mapperViews.local.json)
   ```
2. Este archivo ya se encuentra en `.gitignore`, por lo que **Git jamás lo sobreescribirá ni generará conflictos de merge**.
3. La API lo detecta con máxima prioridad sobre el archivo base.
4. Ingresas al Admin Studio (`/admin`) de ese servidor y presionas:
   > **`📥 Sincronizar archivo local a BD`**
   *(Impactará las consultas específicas de ese servidor en su tabla Oracle).*

### Estrategia B: Respaldo y Carga vía JSON desde el Navegador (Sin SSH)
Desde la pestaña **`➕ SQL Studio`** del Admin Studio:
* **`📤 Exportar vistas a JSON`**: Descarga todas las consultas activas de ese servidor a tu computadora como un archivo `.json`.
* **`📁 Subir vistas JSON a BD`**: Te permite seleccionar desde tu máquina el archivo `.json` de un cliente y sincronizarlo directamente en la base de datos de ese servidor, sin tener que entrar por consola ni copiar archivos a mano.

---

## 🛠️ 8. Resolución de Problemas Frecuentes (Troubleshooting)

### Error 1: `DPI-1047: Cannot locate a 64-bit Oracle Client library`
* **Causa:** Se intentó cargar el cliente binario (Thick Mode) pero el sistema no encuentra las librerías binarias nativas (`libclntsh.so` en Linux o `.dylib` en macOS).
* **Solución:**
  1. **Si tu BD es Oracle 12c, 19c, 21c o 23c:** ¡No necesitas Instant Client! Asegúrate de que la variable `ORACLE_CLIENT_LIB_DIR` esté comentada o vacía en tu archivo `.env`. La API operará automáticamente en **Modo Thin (Puro JavaScript)** sin requerir ninguna librería binaria ni arrojar este error.
  2. **Si tu BD es Oracle 11g Release 2:** En 11g sí es obligatorio el Instant Client. Si estás en Linux instala `libaio1` (`sudo apt-get install -y libaio1`), verifica que descomprimiste el cliente 19c/23c y que `ORACLE_CLIENT_LIB_DIR` en tu `.env` apunte a esa carpeta.
  3. Ejecuta `node scripts/test-oracle-client.js` para diagnosticar el estado exacto.

### Error 2: `ORA-12541: TNS:no listener` o `ORA-12170: Connect timeout occurred`
* **Causa:** El servidor donde corre Node.js no puede alcanzar la IP/puerto de Oracle.
* **Solución:**
  1. Verifica si necesitas conectarte a una VPN municipal/privada.
  2. Prueba conectividad de red: `nc -zv <HOST_ORACLE> 1521`.
  3. Verifica que el firewall de Oracle o del servidor permita el tráfico en el puerto 1521.

### Error 3: `ORA-01017: invalid username/password; logon denied`
* **Causa:** Usuario o contraseña incorrectos en el archivo `.env`.
* **Solución:** Revisa las variables `USERDB` y `PASSWORD` en `.env`. Asegúrate de que no tengan espacios accidentales al inicio o final.

### Error 4: `401 Unauthorized` al intentar entrar al Admin Studio o invocar `/api/import/*`
* **Causa:** La clave ingresada no coincide con `ADMIN_ACCESS_KEY` del `.env`.
* **Solución:** Revisa el valor asignado a `ADMIN_ACCESS_KEY` en tu archivo `.env`. Si lo cambiaste recientemente, reinicia el servicio (`pm2 restart api_liquid`).

### Error 5: `413 Payload Too Large` al subir un archivo Excel pesado
* **Causa:** El proxy inverso Nginx bloquea archivos mayores a 1MB por defecto.
* **Solución:** Agrega `client_max_body_size 50M;` dentro del bloque `server` o `location` de tu configuración Nginx y recárgalo (`sudo nginx -s reload`).

---

## 📞 Soporte y Mantenimiento

* **Repositorio Oficial:** [https://github.com/jferreyradev/node-apiliq](https://github.com/jferreyradev/node-apiliq)
* **Documentación Completa de Endpoints:** Consulta el archivo [`README.md`](README.md).
