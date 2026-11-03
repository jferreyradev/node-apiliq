const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const config = require('../config/database');
const { simpleExecute } = require('../services/database');

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
        email: req.body.email
    };

    try {
        const secret = config.jwtSecretKey || process.env.JWT_SECRET || 'liqsys_secret_jwt_key_2026';

        user.hashedPassword = await bcrypt.hash(req.body.pws, 10);
        await insertUser(user);

        const payload = {
            sub: user.userName,
            role: req.body.idrol || 1
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
        const query = `
            SELECT ID, USR, PWS, MAIL, IDROL, ACTIVO
            FROM US_SUELDO.USUARIOS
            WHERE LOWER(USR) = LOWER(:usr)
        `;
        const result = await simpleExecute(query, { usr: usr.trim() });

        if (!result || !result.rows || result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const userRow = result.rows[0];

        if (Number(userRow.ACTIVO) !== 1) {
            return res.status(403).json({ error: 'El usuario se encuentra inactivo. Contacta al administrador.' });
        }

        const isValid = await bcrypt.compare(pws, userRow.PWS);
        if (!isValid) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const secret = config.jwtSecretKey || process.env.JWT_SECRET || 'liqsys_secret_jwt_key_2026';
        const payload = {
            sub: userRow.USR,
            userId: userRow.ID,
            email: userRow.MAIL,
            role: userRow.IDROL
        };
        const expiresInSeconds = 28800; // 8 horas
        const token = createJwtHS256(payload, secret, expiresInSeconds);

        res.status(200).json({
            status: 'ok',
            token,
            expiresInSeconds,
            user: {
                id: userRow.ID,
                usr: userRow.USR,
                email: userRow.MAIL,
                role: userRow.IDROL
            }
        });
    } catch (err) {
        next(err);
    }
}

async function insertUser(user) {
    await simpleExecute(
        `insert into US_SUELDO.USUARIOS( ID,USR,PWS,MAIL,CREADO,ACTIVO,IDROL)
                values((SELECT NVL(MAX(ID), 0) + 1 FROM US_SUELDO.USUARIOS),:usr, :pwd, :email, :creacion, 1, :idrol)`,
        {
            usr: user.userName,
            email: user.email.toLowerCase(),
            pwd: user.hashedPassword,
            creacion: new Date(),
            idrol: 1
        }
    );
}

module.exports = {
    post,
    login,
    createJwtHS256,
    verifyJwtHS256
};
