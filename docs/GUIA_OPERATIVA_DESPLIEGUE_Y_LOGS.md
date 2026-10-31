# 📖 Manual Operativo: Instalación, Actualización, Ejecución y Logs
## API de Liquidación de Sueldos (`node-apiliq`)

> **Guía práctica para instaladores, administradores de sistemas y operadores de infraestructura.**  
> Esta guía está optimizada principalmente para **servidores y puestos Windows (Windows Server / Windows 10/11)**, e incluye también la sección completa para **Linux y Raspberry Pi**.

---

## 📑 Tabla de Contenidos

1. [Requisitos Previos Generales](#1-requisitos-previos-generales)
2. [🖥️ GUÍA PARA WINDOWS (Entorno Principal)](#2-️-guía-para-windows-entorno-principal)
   - [2.1. Instalación Inicial Paso a Paso en Windows](#21-instalación-inicial-paso-a-paso-en-windows)
   - [2.2. Configuración de Oracle Instant Client en Windows](#22-configuración-de-oracle-instant-client-en-windows)
   - [2.3. Puesta en Producción 24/7 como Servicio de Windows](#23-puesta-en-producción-247-como-servicio-de-windows)
     - [Opción A: Servicio de Windows Nativo con NSSM (Recomendado)](#opción-a-servicio-de-windows-nativo-con-nssm-la-más-estable)
     - [Opción B: Producción con PM2 en Windows](#opción-b-producción-con-pm2-en-windows)
   - [2.4. Cómo Actualizar la API en Windows](#24-cómo-actualizar-la-api-en-windows)
   - [2.5. Cómo Ver los Logs en Windows](#25-cómo-ver-los-logs-en-windows)
3. [🐧 GUÍA PARA LINUX Y RASPBERRY PI](#3--guía-para-linux-y-raspberry-pi)
   - [3.1. Instalación Inicial en Linux / Raspberry Pi](#31-instalación-inicial-en-linux--raspberry-pi)
   - [3.2. Puesta en Marcha con Systemd o PM2](#32-puesta-en-marcha-con-systemd-o-pm2)
   - [3.3. Actualización y Logs en Linux](#33-actualización-y-logs-en-linux)
4. [🩺 Diagnóstico y Verificación de Salud en Vivo](#4--diagnóstico-y-verificación-de-salud-en-vivo)
5. [⚠️ Resolución de Problemas Comunes (Troubleshooting)](#5-️-resolución-de-problemas-comunes-troubleshooting)

---

## 1. Requisitos Previos Generales

* **Node.js:** Versión 18+ o 20+ LTS de 64 bits ([nodejs.org](https://nodejs.org/)).
* **Git:** Para clonar y actualizar ([git-scm.com](https://git-scm.com/)).
* **Oracle Instant Client de 64 bits:** Necesario para conectar a **Oracle Database 11g Release 2 (11.2.x)**.
* **Puerto de Red:** Puerto `3005` libre (o el que se configure en `.env`).

---

## 2. 🖥️ GUÍA PARA WINDOWS (Entorno Principal)

### 2.1. Instalación Inicial Paso a Paso en Windows

Abre **PowerShell** o **Símbolo del sistema (CMD)** como Administrador:

```powershell
# 1. Ubicarse en el directorio deseado (ejemplo: C:\proyectos o C:\servicios)
cd C:\
mkdir servicios -Force
cd C:\servicios

# 2. Clonar el repositorio
git clone https://github.com/jferreyradev/node-apiliq.git
cd node-apiliq

# 3. Instalar las dependencias de Node.js
npm install

# 4. Crear el archivo .env a partir de la plantilla
copy .env.example .env
notepad .env
```

#### Configuración Mínima en `.env`:
Modifica el archivo con los datos del servidor Oracle de la municipalidad:
```env
USERDB="<USUARIO_ORACLE>"
PASSWORD="<PASSWORD_ORACLE>"
# Host/IP del servidor Oracle y servicio (ejemplo: 192.168.1.X:1521/ORCL)
CONNECTIONSTRING="<HOST_ORACLE>:<PUERTO_ORACLE>/<SERVICIO>"

# Clave maestra de administración
ADMIN_ACCESS_KEY="<TU_CLAVE_ADMIN_AQUI>"

PORT=3005
```
*(Guarda con `Ctrl + G` o Archivo > Guardar y cierra el Bloc de notas).*

---

### 2.2. Configuración de Oracle Instant Client en Windows

Para conectar con Oracle 11g, Node.js requiere las librerías `oci.dll` de 64 bits.

#### Método Automático (El más sencillo):
1. Descarga **Oracle Instant Client Basic 19c (o 23c) de 64 bits** para Windows desde el sitio de Oracle:  
   `instantclient-basic-windows.x64-19.24.0.0.0dbru.zip`
2. Descomprime la carpeta en `C:\oracle\instantclient_19_24`.
3. La API en `services/database.js` **detecta automáticamente** cualquier carpeta `C:\oracle\instantclient_*` sin necesidad de tocar variables de entorno.
4. *(Opcional)* También puedes colocar la carpeta descomprimida directamente dentro del proyecto como:  
   `C:\servicios\node-apiliq\oracle-client\instantclient_19_24`

#### Probar que todo funciona:
En la consola dentro de `C:\servicios\node-apiliq`, ejecuta:
```powershell
npm test
```
> **Deberás ver las 107 pruebas automatizadas en verde**.

---

### 2.3. Puesta en Producción 24/7 como Servicio de Windows

Para que la API quede funcionando permanentemente en el servidor municipal (incluso si nadie inicia sesión de usuario o tras un reinicio de Windows):

#### Opción A: Servicio de Windows Nativo con NSSM (La más estable)
**NSSM** (*Non-Sucking Service Manager*) es la herramienta estándar en administración de sistemas Windows para transformar scripts Node.js en Servicios de Windows de arranque automático.

1. Descarga NSSM desde [nssm.cc/download](https://nssm.cc/download) (carpeta `win64\nssm.exe`).
2. Copia `nssm.exe` a `C:\Windows\System32` (o a una carpeta accesible).
3. Abre PowerShell como Administrador e instala el servicio:
   ```powershell
   nssm install node-apiliq "C:\Program Files\nodejs\node.exe" "C:\servicios\node-apiliq\index.js"
   nssm set node-apiliq AppDirectory "C:\servicios\node-apiliq"
   nssm set node-apiliq Description "API Liquidacion de Sueldos - node-apiliq"
   nssm set node-apiliq Start SERVICE_AUTO_START
   
   # Configurar que guarde logs en archivo
   nssm set node-apiliq AppStdout "C:\servicios\node-apiliq\service_out.log"
   nssm set node-apiliq AppStderr "C:\servicios\node-apiliq\service_err.log"
   
   # Iniciar el servicio
   nssm start node-apiliq
   ```
4. **Verificar:** Abre la ventana de Servicios de Windows (`services.msc`) y verás el servicio **`node-apiliq`** en estado **En ejecución** (Automático).

#### Comandos de control del servicio en Windows:
* **Reiniciar:** `nssm restart node-apiliq` (o `Restart-Service node-apiliq`)
* **Detener:** `nssm stop node-apiliq` (o `Stop-Service node-apiliq`)
* **Ver estado:** `nssm status node-apiliq` (o `Get-Service node-apiliq`)

---

#### Opción B: Producción con PM2 en Windows
Si prefieres usar PM2:
```powershell
# 1. Instalar PM2 globalmente
npm install -g pm2

# 2. Iniciar la aplicación
cd C:\servicios\node-apiliq
pm2 start index.js --name "api-sueldos"

# 3. Guardar estado
pm2 save
```
> *Nota para Windows:* Para que PM2 inicie al prender la máquina antes del login, puedes instalar `npm install -g pm2-windows-service` y ejecutar `pm2-service-install`.

---

#### Opción C: Ejecución Manual para Pruebas / Desarrollo
Si solo quieres probar temporalmente en una ventana de consola:
```powershell
cd C:\servicios\node-apiliq
npm start
# O: node index.js
```
*(Presiona `Ctrl + C` para detenerlo).*

---

### 2.4. Cómo Actualizar la API en Windows

Cuando el desarrollador suba cambios o mejoras a GitHub, el instalador solo debe ejecutar:

```powershell
# 1. Entrar a la carpeta
cd C:\servicios\node-apiliq

# 2. Descargar la última versión
git pull origin main

# 3. Actualizar dependencias
npm install

# 4. Validar que todo siga pasando
npm test

# 5. Reiniciar el servicio:
# Si usas NSSM / Servicio de Windows:
Restart-Service node-apiliq

# Si usas PM2:
pm2 reload api-sueldos
```

---

### 2.5. Cómo Ver los Logs en Windows

En PowerShell tienes varias opciones sencillas:

#### 1. Ver el log del servicio en vivo (equivalente a tail -f):
```powershell
Get-Content C:\servicios\node-apiliq\service_err.log -Wait -Tail 30
```

#### 2. Ver el registro de peticiones HTTP en tiempo real:
```powershell
Get-Content C:\servicios\node-apiliq\services\access.log -Wait -Tail 50
```

#### 3. Si usas PM2:
```powershell
pm2 logs api-sueldos
pm2 logs api-sueldos --err
```

#### 4. Buscar un error reportado por su `X-Request-Id`:
```powershell
Select-String -Path "C:\servicios\node-apiliq\service_err.log" -Pattern "52036ead"
```

---

## 3. 🐧 GUÍA PARA LINUX Y RASPBERRY PI

### 3.1. Instalación Inicial en Linux / Raspberry Pi
```bash
# 1. Dependencias del sistema
sudo apt update && sudo apt install -y curl wget git unzip libaio1

# 2. Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Clonar y configurar
cd ~
git clone https://github.com/jferreyradev/node-apiliq.git
cd node-apiliq
npm install
cp .env.example .env
nano .env

# 4. Validar suite
npm test
```

### 3.2. Puesta en Marcha con Systemd o PM2

#### Opción Systemd (Servicio nativo Linux):
Crea el archivo `/etc/systemd/system/node-apiliq.service`:
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
sudo systemctl enable --now node-apiliq
```

#### Opción PM2 (Linux):
```bash
sudo npm install -g pm2
pm2 start index.js --name "api-sueldos"
pm2 save
pm2 startup
```

### 3.3. Actualización y Logs en Linux
```bash
# Actualizar:
cd ~/node-apiliq && git pull origin main && npm install && npm test
sudo systemctl restart node-apiliq   # O: pm2 reload api-sueldos

# Ver logs en vivo:
journalctl -u node-apiliq -f         # O: pm2 logs api-sueldos
tail -f ~/node-apiliq/services/access.log
```

---

## 4. 🩺 Diagnóstico y Verificación de Salud en Vivo

Desde cualquier navegador o terminal (PowerShell / Bash / curl):

### 1. Test de Conectividad Básica:
```bash
curl http://localhost:3005/
```
Respuesta esperada: `{"service":"node-apiliq","status":"online","api":"/api"}`

### 2. Probar Conexión con Oracle Database:
```bash
curl http://localhost:3005/api/admin/health?testDb=true
```
Devuelve estado del servidor y confirma: `"connected": true, "message": "Conexión a Oracle OK"`.

### 3. Supervisar el Pool de Conexiones en Tiempo Real:
```bash
curl -H "X-Admin-Key: <TU_CLAVE_ADMIN>" http://localhost:3005/api/admin/pool-status
```
Muestra conexiones abiertas, en uso y límites de cola.

---

## 5. ⚠️ Resolución de Problemas Comunes (Troubleshooting)

| Error en Pantalla / Log | Causa Frecuente | Solución en Windows / Linux |
| :--- | :--- | :--- |
| `EADDRINUSE: address already in use :::3005` | El puerto 3005 ya está ocupado por otra instancia. | **Windows:** En PowerShell corre `Get-Process -Id (Get-NetTCPConnection -LocalPort 3005).OwningProcess \| Stop-Process -Force`.<br>**Linux:** Corre `npx kill-port 3005`. |
| `DPI-1047: Cannot locate a 64-bit Oracle Client library` | Falta descomprimir Instant Client de 64 bits en Windows o la arquitectura es de 32 bits. | Asegúrate de instalar Node.js de 64 bits y descomprimir Instant Client 64-bit en `C:\oracle\instantclient_19_24`. |
| `ORA-12541: TNS:no listener` o timeout de conexión | La IP o el puerto de Oracle en `.env` son inalcanzables desde esta máquina. | Comprueba con `Test-NetConnection -ComputerName <HOST_ORACLE> -Port <PUERTO_ORACLE>` (en PowerShell) si el puerto está accesible en la red. |
| `ORA-01017: invalid username/password` | Clave o usuario erróneo. | Revisa `USERDB` y `PASSWORD` en tu archivo `.env`. |
| `HTTP 401 Unauthorized` | Petición a ruta administrativa sin clave. | Incluir cabecera `X-Admin-Key: <TU_CLAVE_ADMIN>` en la solicitud HTTP. |
