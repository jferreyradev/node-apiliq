const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const config = require('../config/database');
const database = require('../services/database');
const viewCatalog = require('../services/viewCatalog');

function createJwtHS256(payload, secret, expiresInSeconds = 3600) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const fullPayload = { ...payload, iat: now, exp: now + expiresInSeconds };
    const encHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(`${encHeader}.${encPayload}`).digest('base64url');
    return `${encHeader}.${encPayload}.${signature}`;
}

function verifyJwtHS256(token, secret) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [encHeader, encPayload, signature] = parts;
    try {
        const expectedSig = crypto.createHmac('sha256', secret).update(`${encHeader}.${encPayload}`).digest('base64url');
        const sigBuf = Buffer.from(signature);
        const expBuf = Buffer.from(expectedSig);
        if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
            return null;
        }
        const payload = JSON.parse(Buffer.from(encPayload, 'base64url').toString('utf8'));
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
            return null; // Expirado
        }
        return payload;
    } catch (_) {
        return null;
    }
}

async function post(req, res, next) {
    if (!req.body || !req.body.usr || !req.body.pws || !req.body.email) {
        return res.status(400).json({ error: 'usr, pws y email son requeridos' });
    }

    const user = {
        userName: req.body.usr,
        email: req.body.email,
        dni: req.body.dni || null,
        rol: req.body.idrol || req.body.rol || 1,
        app: req.body.app || 'APP'
    };

    try {
        const secret = config.jwtSecretKey || process.env.JWT_SECRET || 'liqsys_secret_jwt_key_2026';

        user.hashedPassword = await bcrypt.hash(req.body.pws, 10);
        await insertUser(user);

        const payload = {
            sub: user.userName,
            role: user.rol,
            email: user.email
        };
        const token = createJwtHS256(payload, secret, 3600);

        res.status(200).json({
            status: 'ok',
            message: `Usuario '${user.userName}' creado exitosamente`,
            user: user,
            token: token
        });
    } catch (err) {
        next(err);
    }
}

async function login(req, res, next) {
    if (!req.body || !req.body.usr || !req.body.pws) {
        return res.status(400).json({ error: 'Usuario (usr) y contraseña (pws) son requeridos' });
    }

    const { usr, pws } = req.body;

    try {
        // Consultar la definición de la vista 'users' (RAM / API_VIEW_MAPPER / fallback mapperViews.js)
        let viewConfig = null;
        try {
            viewConfig = await viewCatalog.getViewConfig('users');
        } catch (_) {
            // Silencioso ante fallback
        }

        const fields = (viewConfig && viewConfig.fields) || {};
        const fromClause = (viewConfig && viewConfig.sql && Array.isArray(viewConfig.sql.fromClause))
            ? viewConfig.sql.fromClause.join(' ')
            : 'FROM SG_USUARIO';

        // Columnas mapeadas en la vista 'users'
        const colId = fields.Id || 'IDUS';
        const colDni = fields.DNI || 'DNI';
        const colUser = fields.UserName || 'USUARIO';
        const colPass = fields.Password || 'CLAVE';
        const colMail = fields.email || fields.Email || 'MAIL';
        const colEstado = fields.Estado || 'IDESTADOUS';
        const colRol = fields.Rol || 'ROL';
        const colApp = fields.App || 'APP';

        const query = `
            SELECT ${colId} AS IDUS,
                   ${colDni} AS DNI,
                   ${colUser} AS USUARIO,
                   ${colPass} AS CLAVE,
                   ${colMail} AS MAIL,
                   ${colEstado} AS IDESTADOUS,
                   ${colRol} AS ROL,
                   ${colApp} AS APP
            ${fromClause}
            WHERE LOWER(${colUser}) = LOWER(:usr)
        `;

        const result = await database.simpleExecute(query, { usr: usr.trim() });

        if (!result || !result.rows || result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const userRow = result.rows[0];

        // Normalización defensiva de campos (soportando tanto alias como campos originales)
        const idUs = userRow.IDUS !== undefined ? userRow.IDUS : userRow.ID;
        const userName = userRow.USUARIO || userRow.USR;
        const dni = userRow.DNI;
        const mail = userRow.MAIL || userRow.EMAIL;
        const estadoVal = userRow.IDESTADOUS !== undefined ? userRow.IDESTADOUS : userRow.ESTADO;
        const rol = userRow.ROL !== undefined ? userRow.ROL : userRow.IDROL;
        const app = userRow.APP;
        const clave = userRow.CLAVE || userRow.PWS;

        // Verificación de estado activo (1 = Activo, 'A' = Activo, 0 o 2 o 'I' = Inactivo)
        if (estadoVal !== null && estadoVal !== undefined) {
            const estadoStr = String(estadoVal).trim().toUpperCase();
            const isInactive = Number(estadoVal) === 0 ||
                               Number(estadoVal) > 1 ||
                               ['0', '2', 'I', 'B', 'INACTIVO', 'BLOQUEADO', 'BAJA'].includes(estadoStr);
            if (isInactive) {
                return res.status(403).json({ error: 'El usuario se encuentra inactivo. Contacta al administrador.' });
            }
        }

        // Validación de contraseña (Bcrypt, con soporte de transición para texto plano o MD5)
        const storedPassword = clave ? String(clave).trim() : '';
        if (!storedPassword) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        let isValid = false;
        if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$')) {
            isValid = await bcrypt.compare(pws, storedPassword);
        } else {
            isValid = (storedPassword === pws);
            if (!isValid) {
                const md5 = crypto.createHash('md5').update(pws).digest('hex');
                isValid = (storedPassword.toLowerCase() === md5.toLowerCase());
            }
        }

        if (!isValid) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const secret = config.jwtSecretKey || process.env.JWT_SECRET || 'liqsys_secret_jwt_key_2026';
        const payload = {
            sub: userName,
            userId: idUs,
            dni: dni,
            email: mail,
            role: rol,
            app: app
        };
        const expiresInSeconds = 28800; // 8 horas
        const token = createJwtHS256(payload, secret, expiresInSeconds);

        res.status(200).json({
            status: 'ok',
            token,
            expiresInSeconds,
            user: {
                id: idUs,
                usr: userName,
                userName: userName,
                dni: dni,
                email: mail,
                role: rol,
                app: app,
                estado: estadoVal
            }
        });
    } catch (err) {
        next(err);
    }
}

async function insertUser(user) {
    await database.simpleExecute(
        `INSERT INTO SG_USUARIO (IDUS, DNI, USUARIO, CLAVE, MAIL, IDESTADOUS, ROL, APP)
         VALUES ((SELECT NVL(MAX(IDUS), 0) + 1 FROM SG_USUARIO), :dni, :usr, :pwd, :email, 1, :rol, :app)`,
        {
            dni: user.dni || null,
            usr: user.userName,
            pwd: user.hashedPassword,
            email: user.email.toLowerCase(),
            rol: user.rol || 1,
            app: user.app || 'APP'
        }
    );
}

module.exports = {
    post,
    login,
    createJwtHS256,
    verifyJwtHS256
};
