const fs = require('fs');
const oracledb = require('oracledb');

const path = require('path');

const libDir = path.resolve(
    __dirname,
    '..',
    'oracle-client',
    'instantclient_23_3'
);

try {
    if (!fs.existsSync(libDir)) {
        throw new Error(`No existe la carpeta: ${libDir}`);
    }

    console.log(`Cargando Oracle Client desde: ${libDir}`);

    oracledb.initOracleClient({
        libDir
    });

    console.log('Oracle Client cargado correctamente');
    console.log('Versión:', oracledb.oracleClientVersionString);
} catch (error) {
    console.error('No se pudo cargar Oracle Client:');
    console.error(error.message);
    process.exitCode = 1;
}