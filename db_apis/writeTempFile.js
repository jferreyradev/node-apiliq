const fs = require('fs').promises;
const path = require('path');

const tempDirectory = path.resolve(__dirname, '..', 'tmp');

function getTempPath(filename) {
    if (!/^[a-f0-9-]+\.json$/i.test(filename)) {
        throw new Error('Nombre de archivo temporal inválido');
    }

    return path.join(tempDirectory, filename);
}

async function writeFile(data, filename) {
    await fs.mkdir(tempDirectory, { recursive: true });
    await fs.writeFile(getTempPath(filename), data, 'utf8');
}

async function readFile(filename) {
    const data = await fs.readFile(getTempPath(filename), 'utf8');
    
    const datajson = JSON.parse(data);
    
    return datajson.rows;
}

async function removeFile(filename) {
    try {
        await fs.unlink(getTempPath(filename));
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('No se pudo eliminar archivo temporal', error.code);
        }
    }
}

async function readJson(filename) {
    const data = await fs.readFile(getTempPath(filename), 'utf8');
    return JSON.parse(data);
}

module.exports.writeFile = writeFile;

module.exports.readFile = readFile;

module.exports.readJson = readJson;

module.exports.removeFile = removeFile;
