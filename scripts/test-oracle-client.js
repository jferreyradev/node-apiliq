const fs = require('fs');
const path = require('path');
const oracledb = require('oracledb');

function findOracleClient() {
    // 1. Variable explícita ORACLE_CLIENT_LIB_DIR
    if (process.env.ORACLE_CLIENT_LIB_DIR) {
        const customPath = path.resolve(process.env.ORACLE_CLIENT_LIB_DIR);
        if (fs.existsSync(customPath)) {
            return { libDir: customPath, source: 'ORACLE_CLIENT_LIB_DIR' };
        }
        console.warn(`Aviso: ORACLE_CLIENT_LIB_DIR configurado pero no existe: ${customPath}`);
    }

    // 2. Carpeta local del proyecto oracle-client/instantclient_*
    const localBase = path.resolve(__dirname, '..', 'oracle-client');
    if (fs.existsSync(localBase)) {
        try {
            const dirs = fs.readdirSync(localBase);
            for (const d of dirs) {
                const fullPath = path.join(localBase, d);
                if (fs.statSync(fullPath).isDirectory() && d.startsWith('instantclient')) {
                    return { libDir: fullPath, source: `Local Instant Client (${d})` };
                }
            }
        } catch {
            // ignore
        }
    }

    // 3. Cliente Oracle instalado en el host vía ORACLE_HOME
    if (process.env.ORACLE_HOME) {
        const home = path.resolve(process.env.ORACLE_HOME);
        const winBin = path.join(home, 'bin');
        const unixLib = path.join(home, 'lib');

        if (process.platform === 'win32' && fs.existsSync(path.join(winBin, 'oci.dll'))) {
            return { libDir: winBin, source: 'ORACLE_HOME\\bin (Cliente instalado en host)' };
        }
        if (fs.existsSync(path.join(unixLib, 'libclntsh.so'))) {
            return { libDir: unixLib, source: '$ORACLE_HOME/lib (Cliente instalado en host)' };
        }
        if (fs.existsSync(home)) {
            return { libDir: home, source: 'ORACLE_HOME (Host)' };
        }
    }

    // 4. Búsqueda en PATH del sistema
    if (process.env.PATH) {
        const pathDirs = process.env.PATH.split(path.delimiter);
        for (const dir of pathDirs) {
            const cleanDir = dir.trim();
            if (!cleanDir) continue;
            try {
                if (process.platform === 'win32') {
                    if (fs.existsSync(path.join(cleanDir, 'oci.dll'))) {
                        return { libDir: cleanDir, source: `PATH del sistema (${cleanDir})` };
                    }
                } else {
                    if (fs.existsSync(path.join(cleanDir, 'libclntsh.so'))) {
                        return { libDir: cleanDir, source: `PATH del sistema (${cleanDir})` };
                    }
                }
            } catch {
                // ignore
            }
        }
    }

    // 5. Búsqueda en Registro de Windows (HKLM\SOFTWARE\ORACLE)
    if (process.platform === 'win32') {
        try {
            const { execSync } = require('child_process');
            const regOutput = execSync('reg query HKLM\\SOFTWARE\\ORACLE /s 2>nul', { encoding: 'utf8', timeout: 1500 });
            const matches = regOutput.match(/ORACLE_HOME\s+REG_SZ\s+([^\r\n]+)/gi);
            if (matches) {
                for (const m of matches) {
                    const matchParts = m.split(/REG_SZ\s+/i);
                    if (matchParts[1]) {
                        const hDir = matchParts[1].trim();
                        const bDir = path.join(hDir, 'bin');
                        if (fs.existsSync(path.join(bDir, 'oci.dll'))) {
                            return { libDir: bDir, source: `Registro de Windows (${hDir})` };
                        }
                    }
                }
            }
        } catch {
            // ignore
        }
    }

    // 6. Rutas estándar en Linux
    if (process.platform === 'linux') {
        const linuxDirs = [
            '/u01/app/oracle/product/11.2.0/client_1/lib',
            '/usr/lib/oracle/23/client64/lib',
            '/usr/lib/oracle/21/client64/lib',
            '/usr/lib/oracle/19.23/client64/lib',
            '/usr/lib/oracle/19.8/client64/lib',
            '/usr/lib/oracle/11.2/client64/lib',
            '/opt/oracle/instantclient_23_4',
            '/opt/oracle/instantclient_19_23',
            '/opt/oracle/instantclient_19_8',
            '/opt/oracle/instantclient_11_2'
        ];
        for (const ld of linuxDirs) {
            if (fs.existsSync(path.join(ld, 'libclntsh.so')) || fs.existsSync(ld)) {
                return { libDir: ld, source: `Ruta estándar Linux (${ld})` };
            }
        }
    }

    return null;
}

console.log('=== Diagnóstico de Conexión Oracle (Dual: Instant Client + Cliente del Host) ===');
console.log(`• Plataforma: ${process.platform} (${process.arch})`);
console.log(`• Node.js: ${process.version}`);
console.log(`• ORACLE_HOME: ${process.env.ORACLE_HOME || '(no definido)'}`);
console.log(`• ORACLE_CLIENT_LIB_DIR: ${process.env.ORACLE_CLIENT_LIB_DIR || '(no definido)'}`);

const detected = findOracleClient();

try {
    if (detected) {
        console.log(`\n🔍 Cliente Oracle detectado vía: ${detected.source}`);
        console.log(`   Ruta de librerías: ${detected.libDir}`);
        oracledb.initOracleClient({ libDir: detected.libDir });
    } else {
        console.log('\n🔍 No se encontró ruta específica. Intentando cargar librerías del sistema...');
        oracledb.initOracleClient();
    }

    console.log('✅ Oracle Client (Modo Thick) cargado correctamente');
    console.log('   Versión detectada:', oracledb.oracleClientVersionString || 'Detectada por sistema');
    console.log('-> Estado: LISTO para conectar a Oracle Database 11.2 (11g R2), 12c, 18c, 19c, 21c, 23c.');
} catch (error) {
    console.log('\nℹ Modo Thick no disponible con la configuración actual:');
    console.log('  Error:', error.message);
    console.log('\n💡 Para conectar a bases de datos Oracle 11.2 (11g) se requiere Modo Thick.');
    console.log('   Puedes usar CUALQUIERA de las dos opciones:');
    console.log('   1. Cliente Oracle instalado en el host:');
    console.log('      Asegúrate de que la carpeta bin (con oci.dll) o lib esté en PATH o define:');
    console.log('      ORACLE_CLIENT_LIB_DIR=C:\\ruta\\al\\cliente\\bin');
    console.log('   2. Oracle Instant Client (Basic / Basic Light):');
    console.log('      Descomprime Instant Client 19c o 23c y define en tu .env:');
    console.log('      ORACLE_CLIENT_LIB_DIR=./oracle-client/instantclient_23_3');

    if (process.env.ORACLE_CLIENT_LIB_DIR) {
        process.exitCode = 1;
    }
}