# 🔐 Guía Completa de Seguridad y Autenticación (`node-apiliq`)

Esta guía explica en detalle cómo configurar y consumir la API `node-apiliq` de forma segura, los métodos de autenticación disponibles, ejemplos de código en múltiples lenguajes y cómo gestionar las credenciales.

---

## 🧭 1. Resumen del Modelo de Seguridad

La API implementa un modelo **híbrido y desacoplado** diseñado para proteger la base de datos Oracle 11g sin romper la retrocompatibilidad:

```mermaid
flowchart TD
    Cliente([Cliente / Frontend / Script]) --> Red[Internet / Intranet]
    Red --> RateLimiter[Rate Limiter: 15 req/min Auth / 300 req/min Data]
    RateLimiter --> Router{¿Endpoint Solicitado?}

    Router -->|Público: /api/status, /api/health| PublicEndpoints[200 OK sin autenticación]
    Router -->|Login: /api/auth/login| LoginFlow[Autentica en Oracle US_SUELDO.USUARIOS -> Genera JWT]

    Router -->|Datos: /view/*, /sp/*, /fn/*, /xlsx/*| ClientAuthCheck{REQUIRE_AUTH=true?}
    ClientAuthCheck -->|No / false| DataOpen[Permite acceso directo]
    ClientAuthCheck -->|Sí / true| CredentialCheck{¿Credencial enviada?}
    
    CredentialCheck -->|X-API-Key válida| DataAllow[Permite acceso a Datos]
    CredentialCheck -->|Bearer JWT válido| DataAllow
    CredentialCheck -->|X-Admin-Key válida| DataAllow
    CredentialCheck -->|Ninguna o inválida| Data401[HTTP 401 Unauthorized]

    Router -->|Admin: /admin/*, /view/save, /import/*, /sql/execute| AdminAuthCheck{X-Admin-Key válida?}
    AdminAuthCheck -->|Sí| AdminAllow[Permite Operación de Admin]
    AdminAuthCheck -->|No| Admin401[HTTP 401 Unauthorized]
```

---

## ⚙️ 2. Variables de Configuración en el `.env`

En el servidor donde corre la API (ej. Raspberry Pi o servidor Windows/Linux), configura en tu archivo `.env`:

```bash
# 1. Modo de Seguridad Obligatoria
# true  -> Exige credenciales obligatorias para consultar cualquier dato.
# false -> Modo abierto por defecto (para desarrollo local o intranet legacy).
REQUIRE_AUTH=true

# 2. Clave Maestra de Administrador (Acceso total)
# Permite crear vistas, ejecutar SQL libre, importar tablas Excel y ver telemetría profunda.
ADMIN_ACCESS_KEY="clave_super_secreta_admin_2026"

# 3. Clave para Frontends y Aplicaciones (Acceso a vistas, SPs y reportes)
# Ideal para aplicaciones cliente que no requieren login de usuarios individuales.
API_CLIENT_KEY="clave_cliente_portal_sueldos_2026"

# 4. Secreto Criptográfico para Tokens JWT
# Utilizado para firmar y validar tokens de usuarios autenticados con algoritmo HS256.
JWT_SECRET="secreto_para_firma_jwt_hs256_muy_largo_y_seguro"

# 5. Restricción de Orígenes CORS (Opcional, por defecto '*' abierto)
# Limita qué sitios web pueden hacer peticiones desde el navegador.
CORS_WHITELIST="https://mi-portal.com,https://api-rpi.liqsysonline.com,http://localhost:5173"
```

---

## 🔑 3. Los 3 Métodos de Autenticación Soportados

> [!NOTE]
> **Son métodos 100% independientes ("O" lógico):**  
> NO necesitas combinar credenciales. Si envías `Authorization: Bearer <token>`, el token funciona completamente **solo**, sin necesidad de enviar `X-API-Key` ni ninguna otra cabecera adicional. Con CUALQUIERA de los métodos válidos, la API autoriza la consulta.

### Método 1: Clave de Cliente (`X-API-Key`)
**¿Cuándo usarlo?** Para frontends web (Angular, React, Vue), paneles internos o scripts automatizados donde **no hay login individual de usuarios**, pero quieres blindar la API para que nadie de afuera pueda consultarla.

* **Cabecera HTTP:** `X-API-Key: <TU_API_CLIENT_KEY>`
* **Alternativa por URL:** `?api_key=<TU_API_CLIENT_KEY>`

#### Ejemplo con cURL:
```bash
curl "https://api-rpi.liqsysonline.com/api/view/empleadosPorRep?IdRep=1" \
  -H "X-API-Key: clave_cliente_portal_sueldos_2026"
```

#### Ejemplo con JavaScript (`fetch`):
```javascript
const response = await fetch('https://api-rpi.liqsysonline.com/api/view/empleadosPorRep?IdRep=1', {
  headers: {
    'X-API-Key': 'clave_cliente_portal_sueldos_2026'
  }
});
const data = await response.json();
console.log(data);
```

---

### Método 2: Autenticación por Usuario con JWT (`Bearer <token>`)
**¿Cuándo usarlo?** Cuando tu aplicación cuenta con una pantalla de inicio de sesión con **Usuario y Contraseña**. Los usuarios se validan en la tabla `US_SUELDO.USUARIOS` de Oracle.

#### Paso 1: El usuario inicia sesión (`POST /api/auth/login`)
* **Endpoint:** `POST https://api-rpi.liqsysonline.com/api/auth/login`
* **Body (JSON):**
```json
{
  "usr": "jferreyra",
  "pws": "contraseña123"
}
```

#### Ejemplo de Login con cURL:
```bash
curl -X POST https://api-rpi.liqsysonline.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usr":"jferreyra", "pws":"contraseña123"}'
```

**Respuesta exitosa de la API (HTTP 200):**
```json
{
  "status": "ok",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqZmVycmV5cmEiLCJ1c2VySWQiOjUsInJvbGUiOjEsImlhdCI6MTc2MjM1MDAwMCwiZXhwIjoxNzYyMzc4ODAwfQ...",
  "expiresInSeconds": 28800,
  "user": {
    "id": 5,
    "userName": "jferreyra",
    "email": "jferreyra@ejemplo.com",
    "role": 1
  }
}
```

#### Paso 2: Usar el token recibido para consultar datos
Envías el token en la cabecera `Authorization: Bearer <token>`:

```bash
curl "https://api-rpi.liqsysonline.com/api/view/empleadosPorRep?IdRep=1" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### Ejemplo completo en JavaScript con manejo de Token:
```javascript
// 1. Iniciar sesión y guardar token
async function login(usr, pws) {
  const res = await fetch('https://api-rpi.liqsysonline.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usr, pws })
  });
  const data = await res.json();
  if (data.token) {
    localStorage.setItem('auth_token', data.token);
  }
}

// 2. Consultar cualquier endpoint de datos con el token
async function obtenerEmpleados() {
  const token = localStorage.getItem('auth_token');
  const res = await fetch('https://api-rpi.liqsysonline.com/api/view/empleadosPorRep?IdRep=1', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return await res.json();
}
```

---

### Método 3: Clave de Administrador (`X-Admin-Key`)
**¿Cuándo usarlo?** Para el panel de control **`api-liq-admin`**, administradores de sistemas y tareas de mantenimiento crítico. Tiene acceso absoluto tanto a los endpoints de datos como a las funciones administrativas.

* **Cabecera HTTP:** `X-Admin-Key: <ADMIN_ACCESS_KEY>`

#### Endpoints que requieren exclusivamente `X-Admin-Key`:
* `POST /api/view/save` (Crear o modificar vistas en Oracle).
* `POST /api/view/refresh` (Vaciar y refrescar la caché RAM de vistas).
* `POST /api/sql/execute` (Ejecutar consultas libres de prueba en el SQL Studio).
* `POST /api/sp/sync-oracle` (Sincronizar en vivo SPs desde `ALL_ARGUMENTS`).
* `POST /api/import/*` (Carga masiva de tablas desde Excel/CSV).
* `GET /api/admin/pool-status` (Telemetría profunda del pool de conexiones Oracle).
* `POST /api/adduser` (Creación de nuevos usuarios con hash bcrypt).

#### Ejemplo con cURL:
```bash
curl https://api-rpi.liqsysonline.com/api/admin/pool-status \
  -H "X-Admin-Key: clave_super_secreta_admin_2026"
```

---

## 🟢 4. Endpoints Públicos (Sin Autenticación)

Para permitir chequeos de estado, monitores externos (UptimeRobot, Cloudflare Health Checks) y balanceadores, estos endpoints **siempre responden HTTP 200 sin exigir credenciales**:

* `GET /api/status` (Telemetría ligera del servicio, uptime y estado del pool).
* `GET /api/health` (Salud del servicio).
* `GET /status` (Mismo estado disponible en la raíz del servidor).
* `POST /api/auth/login` (Inicio de sesión para obtener token).

---

## 🚫 5. Códigos y Mensajes de Error

Cuando una petición no cumple con la seguridad, la API responde con un formato JSON estructurado:

### HTTP 401 Unauthorized (Falta credencial o es inválida)
```json
{
  "status": "error",
  "code": "UNAUTHORIZED",
  "error": "Acceso no autorizado. Se requiere cabecera X-API-Key, X-Admin-Key o token Bearer JWT válido.",
  "hint": "Configura REQUIRE_AUTH=false en .env si deseas permitir acceso anónimo en este entorno."
}
```

### HTTP 403 Forbidden (Usuario inactivo o permisos insuficientes)
```json
{
  "error": "El usuario se encuentra inactivo. Contacta al administrador."
}
```

### HTTP 429 Too Many Requests (Límite de tasa excedido)
Se activa si una IP intenta más de 15 logins por minuto o más de 300 peticiones generales por minuto:
```json
{
  "status": "error",
  "code": "RATE_LIMIT_EXCEEDED",
  "error": "Demasiados intentos de acceso o administración. Por seguridad, espera 1 minuto antes de reintentar.",
  "retryAfterSeconds": 45
}
```
*Cabeceras incluidas:* `Retry-After: 45`, `RateLimit-Limit: 15`, `RateLimit-Remaining: 0`.

---

## 🛠️ 6. Cómo Configurar en Clientes Populares

### En Postman / Insomnia:
1. Crea una nueva petición (ej. `GET https://api-rpi.liqsysonline.com/api/view/list`).
2. Ve a la pestaña **Headers**.
3. Agrega:
   - Key: `X-API-Key` | Value: `<tu_api_client_key>`  
   *(o en la pestaña **Authorization** elige **Bearer Token** y pega tu JWT).*

### En el panel `api-liq-admin`:
1. Abre el panel en `http://localhost:5173`.
2. Haz clic en el botón **"Configurar"** (arriba a la derecha).
3. Ingresa tu `ADMIN_ACCESS_KEY` y la URL `https://api-rpi.liqsysonline.com`.
4. El panel enviará automáticamente la cabecera `X-Admin-Key` en todas las peticiones.
