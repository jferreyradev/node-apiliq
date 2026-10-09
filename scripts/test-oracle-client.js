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

    console.log('Oracle Client cargado correctamente');
    console.log('Versión:', oracledb.oracleClientVersionString || 'Detectada por sistema');
} catch (error) {
    console.error('No se pudo cargar Oracle Client:');
    console.error(error.message);
    process.exitCode = 1;
}