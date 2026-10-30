# 📖 Manual Operativo: Instalación, Actualización, Ejecución y Logs
## API de Liquidación de Sueldos (`node-apiliq`)

> **Guía práctica para administradores de sistemas, desarrolladores y operadores de infraestructura.**  
> Cubre el ciclo de vida completo del servicio: despliegue inicial, actualizaciones continuas, gestión de procesos en segundo plano y monitoreo de logs en tiempo real.

---

## 📑 Tabla de Contenidos

1. [Requisitos Previos del Servidor](#1-requisitos-previos-del-servidor)
2. [Instalación Inicial desde Cero](#2-instalación-inicial-desde-cero)
3. [Actualización a una Nueva Versión](#3-actualización-a-una-nueva-versión)
4. [Puesta en Funcionamiento (Modos de Ejecución)](#4-puesta-en-funcionamiento-modos-de-ejecución)
   - [Opción 1: Producción con PM2 (Recomendado)](#opción-1-producción-con-pm2-recomendado-para-linux--raspberry-pi)
   - [Opción 2: Producción con Systemd (Linux Nativo)](#opción-2-producción-con-systemd-servicio-nativo-de-linux)
   - [Opción 3: Modo Desarrollo / Depuración](#opción-3-modo-desarrollo--depuración-interactiva)
5. [Monitoreo y Visualización de Logs en Vivo](#5-monitoreo-y-visualización-de-logs-en-vivo)
6. [Comprobación Rápida de Salud y Diagnóstico](#6-comprobación-rápida-de-salud-y-diagnóstico)
7. [Resolución de Problemas Comunes (Troubleshooting)](#7-resolución-de-problemas-comunes-troubleshooting)

---

## 1. Requisitos Previos del Servidor

* **Sistema Operativo:** Linux (Ubuntu, Debian, Raspberry Pi OS 64 bits, RHEL), macOS o Windows Server.
* **Node.js:** Versión 18+ o 20+ LTS (`node -v`).
* **Git:** Para control de versiones (`git --version`).
* **Oracle Instant Client:** 
  * Requerido en **Modo Thick** para conectar con **Oracle Database 11g Release 2 (11.2.x)**.
  * Versiones recomendadas: Instant Client 19c o 23c Basic.

---

## 2. Instalación Inicial desde Cero

Ejecuta en la terminal del servidor:

```bash
# 1. Clonar el repositorio
git clone https://github.com/jferreyradev/node-apiliq.git
cd node-apiliq

# 2. Instalar dependencias
npm install

# 3. Crear el archivo de configuración .env
cp .env.example .env
nano .env
```

### Configuración Mínima Esencial en `.env`:
```env
# Conexión a Oracle
USERDB="US_SUELDO"
PASSWORD="TuPassword"
CONNECTIONSTRING="192.168.1.50:1521/desa"

# Seguridad Administrativa
ADMIN_ACCESS_KEY="admin_liq_2026"

# Puerto (Opcional, por defecto 3005)
PORT=3005

# Instant Client (Solo si está en una ruta no estándar del sistema)
# ORACLE_CLIENT_LIB_DIR=./oracle-client/instantclient_23_3
```

### Probar que todo esté correcto:
```bash
npm test
```
> **Resultado esperado:** Los **107 tests automatizados** deben pasar con 0 fallos.

---

## 3. Actualización a una Nueva Versión

Cuando se publiquen mejoras o correcciones en el repositorio de GitHub:

```bash
# 1. Entrar al directorio
cd ~/node-apiliq

# 2. Descargar los últimos cambios
git pull origin main

# 3. Actualizar dependencias
npm install

# 4. Validar suite de pruebas
npm test

# 5. Reiniciar el servicio (según el método que uses):
# Si usas PM2:
pm2 reload api-sueldos

# Si usas Systemd:
sudo systemctl restart node-apiliq
```

---

## 4. Puesta en Funcionamiento (Modos de Ejecución)

### Opción 1: Producción con PM2 (Recomendado para Linux / Raspberry Pi)
PM2 es un gestor de procesos que mantiene la API viva 24/7 y la reinicia automáticamente tras cortes de luz o fallos.

```bash
# 1. Instalar PM2 globalmente (si no lo tienes)
sudo npm install -g pm2

# 2. Iniciar la API
pm2 start index.js --name "api-sueldos"

# 3. Guardar la lista de procesos activos
pm2 save

# 4. Configurar el autoarranque en el inicio del sistema operativo
pm2 startup
# (Copia y pega en la terminal el comando 'sudo env PATH...' que PM2 te imprima)
```

#### Comandos útiles de PM2:
* **Ver estado:** `pm2 status`
* **Reiniciar sin desconexiones:** `pm2 reload api-sueldos`
* **Detener:** `pm2 stop api-sueldos`
* **Reiniciar en frío:** `pm2 restart api-sueldos`

---

### Opción 2: Producción con Systemd (Servicio Nativo de Linux)
Si prefieres no usar herramientas externas y administrar la API como servicio oficial del sistema operativo:

```bash
sudo nano /etc/systemd/system/node-apiliq.service
```

Pega el siguiente contenido (ajustando tu usuario y ruta):
```ini
[Unit]
Description=API Liquidacion de Sueldos (node-apiliq)
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/node-apiliq
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Habilitar e iniciar:
```bash
sudo systemctl daemon-reload
sudo systemctl enable node-apiliq
sudo systemctl start node-apiliq
```

---

### Opción 3: Modo Desarrollo / Depuración Interactiva
Para probar cambios locales viendo la salida directa en la consola:

```bash
# Con reinicio automático ante cambios en el código:
npm start

# O ejecución directa con Node:
node index.js
```
*(Presiona `Ctrl + C` para detenerlo).*

---

## 5. Monitoreo y Visualización de Logs en Vivo

### A. Si usas PM2:
```bash
# Ver logs en tiempo real (streaming continuo)
pm2 logs api-sueldos

# Ver las últimas 100 líneas
pm2 logs api-sueldos --lines 100

# Ver solo los errores
pm2 logs api-sueldos --err

# Vaciar / limpiar los logs acumulados
pm2 flush
```

---

### B. Si usas Systemd:
```bash
# Ver logs en vivo (equivalente a tail -f)
journalctl -u node-apiliq -f

# Ver las últimas 50 líneas
journalctl -u node-apiliq -n 50 --no-pager
```

---

### C. Archivo de Registro de Peticiones HTTP (`access.log`)
Cada consulta HTTP atendida por Express se registra en el archivo `services/access.log`:

```bash
tail -f ~/node-apiliq/services/access.log
```

---

### D. Trazabilidad con `X-Request-Id`
Cada error capturado por la API se registra en los logs con un identificador único:
```text
API request failed {
  requestId: '52036ead-dc06-43b6-aba9-884162faa678',
  method: 'GET',
  path: '/api/view/empleados',
  statusCode: 500,
  message: 'ORA-00942: table or view does not exist'
}
```
Si un usuario reporta un problema, solo necesitas pedirle el `X-Request-Id` (visible en las cabeceras de respuesta o en la consola del navegador) y buscarlo en el log:
```bash
grep "52036ead" ~/.pm2/logs/api-sueldos-error.log
```

---

## 6. Comprobación Rápida de Salud y Diagnóstico

### 1. Test de Conectividad Básica:
```bash
curl -I http://localhost:3005/
```
Respuesta esperada: `HTTP/1.1 200 OK`

### 2. Estado General y Conexión a Base de Datos:
```bash
curl http://localhost:3005/api/admin/health?testDb=true
```
Responde un JSON con el tiempo de actividad (`uptimeSeconds`) y el estado de la conexión a Oracle (`connected: true`).

### 3. Métricas en Tiempo Real del Pool de Conexiones:
```bash
curl -H "X-Admin-Key: admin_liq_2026" http://localhost:3005/api/admin/pool-status
```
Devuelve la cantidad de conexiones abiertas y en uso en Oracle:
```json
{
  "service": "node-apiliq",
  "pool": {
    "status": "open",
    "open": true,
    "connectionsOpen": 5,
    "connectionsInUse": 1,
    "poolMin": 0,
    "poolMax": 10
  },
  "timestamp": "2026-10-30T22:58:00.000Z"
}
```

---

## 7. Resolución de Problemas Comunes (Troubleshooting)

| Síntoma / Error | Causa Probable | Solución Inmediata |
| :--- | :--- | :--- |
| `EADDRINUSE: address already in use :::3005` | Hay otra instancia de la API o un proceso ocupando el puerto 3005. | Ejecuta: `npx kill-port 3005` o busca el proceso con `lsof -i :3005` y ciérralo con `kill -9 <PID>`. |
| `DPI-1047: Cannot locate a 64-bit Oracle Client library` | Falta instalar Instant Client o la arquitectura no coincide (ej. SO de 32 bits). | Asegúrate de usar un SO de 64 bits (`uname -m` debe decir `x86_64` o `aarch64`) e instala Instant Client siguiendo el paso 3 del instructivo. |
| `ORA-12541: TNS:no listener` | La IP o el puerto de Oracle en `CONNECTIONSTRING` son incorrectos o el servicio de Oracle está apagado. | Verifica la IP con `ping <ip>` o prueba la conexión con `telnet <ip> 1521`. |
| `ORA-01017: invalid username/password` | Usuario o clave incorrectos en `.env`. | Revisa `USERDB` y `PASSWORD` en tu archivo `.env`. |
| `HTTP 401 Unauthorized` en rutas de administración | Clave administrativa ausente o incorrecta. | Incluye la cabecera `X-Admin-Key: tu_clave` en tu cliente HTTP. |
