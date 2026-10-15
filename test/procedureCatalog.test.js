const test = require('node:test');
const assert = require('node:assert/strict');
const procedureCatalog = require('../services/procedureCatalog');

test('procedureCatalog resuelve procedimientos y funciones', async (t) => {

    await t.test('obtiene SP existente desde el fallback legacy', async () => {
        procedureCatalog.clearCache();
        const config = await procedureCatalog.getSpConfig('cambioPeriodo');
        assert.ok(config, 'Debe retornar la configuración de cambioPeriodo');
        assert.strictEqual(config.sp_name, 'MOD_CAMBIO_PERIODO.P_Cambio_Periodo');
        assert.deepStrictEqual(config.out_param, ['ValorSalida']);
    });

    await t.test('almacena en memoria RAM el SP consultado', async () => {
        assert.ok(procedureCatalog._spCache.has('cambioPeriodo'));
    });

    await t.test('obtiene Función existente desde el fallback legacy', async () => {
        procedureCatalog.clearCache();
        const config = await procedureCatalog.getFnConfig('verifConcepto');
        assert.ok(config, 'Debe retornar la función verifConcepto');
        assert.strictEqual(config.fn_name, 'MOD_FUNCIONES.EXISTE_CONCEPTO');
    });

    await t.test('almacena en memoria RAM la función consultada', async () => {
        assert.ok(procedureCatalog._fnCache.has('verifConcepto'));
    });


    await t.test('resolveNameParts descompone alias cortos y nombres calificados', () => {
        const r1 = procedureCatalog.resolveNameParts('nov_spiHojaNov');
        assert.strictEqual(r1.pkgName, 'MOD_NOV');
        assert.strictEqual(r1.procName, 'SPI_HOJA_NOV');

        const r2 = procedureCatalog.resolveNameParts('MOD_LIQUIDACION.LIQ_PRINCIPAL');
        assert.strictEqual(r2.pkgName, 'MOD_LIQUIDACION');
        assert.strictEqual(r2.procName, 'LIQ_PRINCIPAL');

        const r3 = procedureCatalog.resolveNameParts('spCalculaNeto');
        assert.strictEqual(r3.pkgName, null);
        assert.strictEqual(r3.procName, 'SP_CALCULA_NETO');
    });

    await t.test('buildConfigFromRows construye configuración de SP a partir de ALL_ARGUMENTS', () => {
        const rows = [
            { PACKAGE_NAME: 'MOD_EMPLEADOS', OBJECT_NAME: 'SPI_LEGAJO', ARGUMENT_NAME: 'P_IDPERS', POSITION: 1, DATA_TYPE: 'NUMBER', IN_OUT: 'IN' },
            { PACKAGE_NAME: 'MOD_EMPLEADOS', OBJECT_NAME: 'SPI_LEGAJO', ARGUMENT_NAME: 'P_PERIODO', POSITION: 2, DATA_TYPE: 'NUMBER', IN_OUT: 'IN' },
            { PACKAGE_NAME: 'MOD_EMPLEADOS', OBJECT_NAME: 'SPI_LEGAJO', ARGUMENT_NAME: 'P_VALOR_SALIDA', POSITION: 3, DATA_TYPE: 'NUMBER', IN_OUT: 'OUT' },
            { PACKAGE_NAME: 'MOD_EMPLEADOS', OBJECT_NAME: 'SPI_LEGAJO', ARGUMENT_NAME: 'P_VALOR_ERROR', POSITION: 4, DATA_TYPE: 'NUMBER', IN_OUT: 'OUT' }
        ];

        const built = procedureCatalog.buildConfigFromRows(rows);
        assert.strictEqual(built.isFunction, false);
        assert.strictEqual(built.config.sp_name, 'MOD_EMPLEADOS.SPI_LEGAJO');
        assert.deepStrictEqual(built.config.in_param, ['Idpers', 'Periodo']);
        assert.deepStrictEqual(built.config.out_param, ['ValorSalida', 'ValorError']);
    });

    await t.test('buildConfigFromRows construye configuración de Función a partir de ALL_ARGUMENTS', () => {
        const rows = [
            { PACKAGE_NAME: 'MOD_FUNCIONES', OBJECT_NAME: 'F_CALCULAR', ARGUMENT_NAME: null, POSITION: 0, DATA_TYPE: 'NUMBER', IN_OUT: 'OUT' },
            { PACKAGE_NAME: 'MOD_FUNCIONES', OBJECT_NAME: 'F_CALCULAR', ARGUMENT_NAME: 'P_ID', POSITION: 1, DATA_TYPE: 'NUMBER', IN_OUT: 'IN' }
        ];

        const built = procedureCatalog.buildConfigFromRows(rows);
        assert.strictEqual(built.isFunction, true);
        assert.strictEqual(built.config.fn_name, 'MOD_FUNCIONES.F_CALCULAR');
        assert.deepStrictEqual(built.config.in_param, { Id: 'P_ID' });
    });

    await t.test('getAllSp y getAllFn devuelven colecciones completas', async () => {
        const allSp = await procedureCatalog.getAllSp();
        const allFn = await procedureCatalog.getAllFn();
        assert.ok(Object.keys(allSp).length > 0);
        assert.ok(Object.keys(allFn).length > 0);
    });

    await t.test('clearCache vacía la memoria RAM', () => {
        procedureCatalog.clearCache();
        assert.strictEqual(procedureCatalog._spCache.size, 0);
        assert.strictEqual(procedureCatalog._fnCache.size, 0);
    });

    await t.test('obtiene SP desde spmapper.generated cuando no está en legacy spmapper', async () => {
        const config = await procedureCatalog.getSpConfig('exportacion_generaArchivoAcred');
        assert.ok(config, 'Debe resolver SP desde generated mapper');
        assert.strictEqual(config.sp_name, 'MOD_EXPORTACION.GENERA_ARCHIVO_ACRED');
        assert.ok(config.in_param.includes('vLEY'));
    });

    await t.test('spapi.getSQLcall genera bloque PL/SQL válido y limpio', () => {
        const spapi = require('../db_apis/sp');
        const spConfig = {
            sp_name: 'MOD_EXPORTACION.GENERA_ARCHIVO_ACRED ',
            in_param: ['Periodo', 'TipoLiquidacionId', 'GrupoAdicionalId', 'Ley']
        };
        const sql = spapi.getSQLcall(spConfig);
        assert.strictEqual(sql, 'BEGIN MOD_EXPORTACION.GENERA_ARCHIVO_ACRED(:Periodo, :TipoLiquidacionId, :GrupoAdicionalId, :Ley); END;');
    });

    await t.test('spapi.getSQLbinds resuelve campos de forma insensible a mayúsculas y prefijos', () => {
        const spapi = require('../db_apis/sp');
        const spConfig = {
            sp_name: 'MOD_EXPORTACION.GENERA_ARCHIVO_ACRED',
            in_param: ['Periodo', 'TipoLiquidacionId', 'GrupoAdicionalId', 'Ley'],
            out_param: ['ValorSalida']
        };
        const context = {
            periodo: 202401,
            tipoliquidacionid: 2,
            vIDGRUPOADI: 0
        };
        const binds = spapi.getSQLbinds(context, spConfig);
        assert.strictEqual(binds.Periodo, 202401);
        assert.strictEqual(binds.TipoLiquidacionId, 2);
        assert.strictEqual(binds.GrupoAdicionalId, 0);
        assert.strictEqual(binds.Ley, null);
        assert.ok(binds.ValorSalida && binds.ValorSalida.dir !== undefined);
    });
});

