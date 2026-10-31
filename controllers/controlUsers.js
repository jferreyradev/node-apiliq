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

async function post(req, res, next) {
    if (!req.body || !req.body.usr || !req.body.pws || !req.body.email) {
        return res.status(400).json({ error: 'usr, pws y email son requeridos' });
    }

    const user = {
        userName: req.body.usr,
        email: req.body.email
    };

    try {
        if (!config.jwtSecretKey) {
            throw new Error('JWT_SECRET no está configurado');
        }

        user.hashedPassword = await bcrypt.hash(req.body.pws, 10);
        await insertUser(user);

        const payload = {
            sub: user.userName,
            role: 1
        };
        const token = createJwtHS256(payload, config.jwtSecretKey, 3600);

        res.status(200).json({
            user: user,
            token: token
        });
    } catch (err) {
        next(err);
    }
}

module.exports.post = post;
module.exports.createJwtHS256 = createJwtHS256;

async function insertUser(user) {

    //connection = await database.simpleExecute .getConnection(dbConfig);

    const res = await simpleExecute (
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