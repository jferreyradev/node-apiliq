var bcrypt = require('bcrypt');
var config = require('../config/database')

const { simpleExecute, getConnection } = require('../services/database');

async function post(req, res, next) {
    var user = {
        userName: req.body.usr,
        email: req.body.email
    };

    try {
        if (!config.jwtSecretKey) {
            throw new Error('JWT_SECRET no está configurado');
        }

        user.hashedPassword = await bcrypt.hash(req.body.pws, 10);
        await insertUser(user);

        const { SignJWT } = await import('jose');
        const payload = {
            sub: user.userName,
            role: 1
        };
        const token = await new SignJWT(payload)
            .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
            .setIssuedAt()
            .setExpirationTime('1h')
            .sign(new TextEncoder().encode(config.jwtSecretKey));

        res.status(200).json({
            user: user,
            token: token
        });
    } catch (err) {
        next(err);
    }
}

module.exports.post = post;

async function insertUser(user) {

    //connection = await database.simpleExecute .getConnection(dbConfig);

    const res = await simpleExecute (
        `insert into US_SUELDO.USUARIOS( ID,USR,PWS,MAIL,CREADO,ACTIVO,IDROL)
                values(1,:usr, :pwd, :email, :creacion, 1, :idrol)`,
        {
            usr: user.userName,
            email: user.email.toLowerCase(),
            pwd: user.hashedPassword,
            creacion: new Date(),
            idrol: 1
        }
    );
}