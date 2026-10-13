const fs = require('fs');
const oracledb = require('oracledb');

const path = require('path');

const customDir = process.env.ORACLE_CLIENT_LIB_DIR ? path.resolve(process.env.ORACLE_CLIENT_LIB_DIR) : null;
const defaultLibDir = path.resolve(
    __dirname,
    '..',
    'oracle-client',
    'instantclient_23_3'
);

try {
    if (customDir) {
        if (!fs.existsSync(customDir)) {
            throw new Error(`La ruta configurada en ORACLE_CLIENT_LIB_DIR no existe: ${customDir}`);
        }
        console.log(`Cargando Oracle Client desde ORACLE_CLIENT_LIB_DIR: ${customDir}`);
        oracledb.initOracleClient({ libDir: customDir });
    } else if (fs.existsSync(defaultLibDir)) {
        console.log(`Cargando Oracle Client desde carpeta local: ${defaultLibDir}`);
        oracledb.initOracleClient({ libDir: defaultLibDir });
    } else {
        console.log('Intentando cargar Oracle Client desde librerías del sistema...');
        oracledb.initOracleClient();
    }

    console.log('Oracle Client (Thick Mode) cargado correctamente');
    console.log('Versión de Instant Client:', oracledb.oracleClientVersionString || 'Detectada por sistema');
    console.log('-> Estado: Listo para conectar a cualquier versión de Oracle (incluyendo Oracle 11g R2, 12c, 19c, 21c, 23c).');
} catch (error) {
    console.log('\nℹ Oracle Instant Client no detectado en el sistema o carpeta local:');
    console.log('  ' + error.message);
    console.log('\n💡 Diagnóstico de Modos de Conexión de node-oracledb:');
    console.log('  • Modo Thin (100% JavaScript, sin binarios nativos):');
    console.log('    Si tu base de datos es Oracle 12c, 18c, 19c, 21c o 23c, la API funciona');
    console.log('    directamente sin necesidad de instalar Oracle Instant Client.');
    console.log('  • Modo Thick (Requiere Oracle Instant Client):');
    console.log('    Solo es obligatorio si te conectas a una base de datos Oracle 11g Release 2 (11.2).');
    console.log('    Si usas 11g, consulta la guía de instalación en PUESTA_EN_MARCHA.md (Paso 3).');

    if (customDir) {
        process.exitCode = 1;
    }
}