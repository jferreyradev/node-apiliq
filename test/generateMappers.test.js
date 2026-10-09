const test = require('node:test');
const assert = require('node:assert/strict');
const {
    groupObjects,
    generateSpMapper,
    generateFnMapper,
    generateSpAlias,
    formatInParam,
    formatOutParam
} = require('../scripts/generate_mappers');

test('Generador de mappers procesa correctamente datos de Oracle USER_ARGUMENTS', async (t) => {
    await t.test('detecta procedimientos y funciones correctamente', () => {
        const mockRows = [
            // Procedimiento en paquete MOD_PARAM.P_VALORCATEGORIA
            {
                PACKAGE_NAME: 'MOD_PARAM',
                OBJECT_NAME: 'P_VALORCATEGORIA',
                OVERLOAD: null,
                ARGUMENT_NAME: 'P_ID',
                POSITION: 1,
                SEQUENCE: 1,
                DATA_TYPE: 'NUMBER',
                IN_OUT: 'IN'
            },
            {
                PACKAGE_NAME: 'MOD_PARAM',
                OBJECT_NAME: 'P_VALORCATEGORIA',
                OVERLOAD: null,
                ARGUMENT_NAME: 'P_VALOR',
                POSITION: 2,
                SEQUENCE: 2,
                DATA_TYPE: 'VARCHAR2',
                IN_OUT: 'IN'
            },
            {
                PACKAGE_NAME: 'MOD_PARAM',
                OBJECT_NAME: 'P_VALORCATEGORIA',
                OVERLOAD: null,
                ARGUMENT_NAME: 'P_VALORSALIDA',
                POSITION: 3,
                SEQUENCE: 3,
                DATA_TYPE: 'VARCHAR2',
                IN_OUT: 'OUT'
            },
            // Función en paquete MOD_FUNCIONES.EXISTE_CONCEPTO (position = 0 es return value)
            {
                PACKAGE_NAME: 'MOD_FUNCIONES',
                OBJECT_NAME: 'EXISTE_CONCEPTO',
                OVERLOAD: null,
                ARGUMENT_NAME: null,
                POSITION: 0,
                SEQUENCE: 1,
                DATA_TYPE: 'NUMBER',
                IN_OUT: 'OUT'
            },
            {
                PACKAGE_NAME: 'MOD_FUNCIONES',
                OBJECT_NAME: 'EXISTE_CONCEPTO',
                OVERLOAD: null,
                ARGUMENT_NAME: 'V_REP',
                POSITION: 1,
                SEQUENCE: 2,
                DATA_TYPE: 'NUMBER',
                IN_OUT: 'IN'
            },
            {
                PACKAGE_NAME: 'MOD_FUNCIONES',
                OBJECT_NAME: 'EXISTE_CONCEPTO',
                OVERLOAD: null,
                ARGUMENT_NAME: 'V_CODIGO',
                POSITION: 2,
                SEQUENCE: 3,
                DATA_TYPE: 'NUMBER',
                IN_OUT: 'IN'
            }
        ];

        const grouped = groupObjects(mockRows);
        assert.equal(grouped.length, 2);

        const proc = grouped.find(g => g.objectName === 'P_VALORCATEGORIA');
        assert.ok(proc);
        assert.equal(proc.isFunction, false);
        assert.equal(proc.arguments.length, 3);

        const fn = grouped.find(g => g.objectName === 'EXISTE_CONCEPTO');
        assert.ok(fn);
        assert.equal(fn.isFunction, true);
        assert.equal(fn.returnType, 'NUMBER');
        assert.equal(fn.arguments.length, 2);
    });

    await t.test('genera aliases con nomenclatura corta <paquete>_<procedimiento>', () => {
        assert.equal(generateSpAlias('SPI_HOJA_NOV', 'MOD_NOV'), 'nov_spiHojaNov');
        assert.equal(generateSpAlias('SPU_HOJA_NOV', 'MOD_NOV'), 'nov_spuHojaNov');
        assert.equal(generateSpAlias('SPD_HOJA_NOV', 'MOD_NOV'), 'nov_spdHojaNov');
        assert.equal(generateSpAlias('SPI_PERSONA', 'MOD_PERSONAS'), 'personas_spiPersona');
        assert.equal(generateSpAlias('P_DESC_CABVALCAT', 'MOD_PARAM'), 'param_descCabvalcat');
    });

    await t.test('formatea parámetros IN respetando vID... y v...', () => {
        assert.equal(formatInParam('VIDHOJANOV'), 'vIDHOJANOV');
        assert.equal(formatInParam('VIDPERS'), 'vIDPERS');
        assert.equal(formatInParam('VREP'), 'vREP');
        assert.equal(formatInParam('VORDEN'), 'vORDEN');
        assert.equal(formatInParam('P_PERIODO'), 'Periodo');
        assert.equal(formatInParam('ID_PERSONA'), 'IdPersona');
    });

    await t.test('formatea parámetros OUT respetando ValorSalida, ValorError, Cursor', () => {
        assert.equal(formatOutParam('P_VALORSALIDA', 'VARCHAR2'), 'ValorSalida');
        assert.equal(formatOutParam('VSALIDA', 'VARCHAR2'), 'ValorSalida');
        assert.equal(formatOutParam('P_VALORERROR', 'VARCHAR2'), 'ValorError');
        assert.equal(formatOutParam('VERRORMSG', 'VARCHAR2'), 'vErrorMsg');
        assert.equal(formatOutParam('P_CURSOR', 'REF CURSOR'), 'Cursor');
    });

    await t.test('genera spmapper con formato idéntico a spmapper.js', () => {
        const proc = {
            packageName: 'MOD_NOV',
            objectName: 'SPI_HOJA_NOV',
            overload: '0',
            isFunction: false,
            arguments: [
                { name: 'VIDTIPOHOJA', position: 1, dataType: 'NUMBER', inOut: 'IN' },
                { name: 'VPERIODO', position: 2, dataType: 'NUMBER', inOut: 'IN' },
                { name: 'VSALIDA', position: 3, dataType: 'VARCHAR2', inOut: 'OUT' },
                { name: 'VERROR', position: 4, dataType: 'VARCHAR2', inOut: 'OUT' },
                { name: 'VERRORMSG', position: 5, dataType: 'VARCHAR2', inOut: 'OUT' }
            ]
        };

        const result = generateSpMapper([proc]);
        assert.ok(result.nov_spiHojaNov);
        assert.equal(result.nov_spiHojaNov.sp_name, 'MOD_NOV.SPI_HOJA_NOV');
        assert.deepEqual(result.nov_spiHojaNov.in_param, ['vIDTIPOHOJA', 'vPERIODO']);
        assert.deepEqual(result.nov_spiHojaNov.out_param, ['ValorSalida', 'ValorError', 'vErrorMsg']);
    });

    await t.test('genera fnmapper con formato idéntico a fnmapper.js', () => {
        const fn = {
            packageName: 'MOD_FUNCIONES',
            objectName: 'EXISTE_CONCEPTO',
            overload: '0',
            isFunction: true,
            returnType: 'NUMBER',
            arguments: [
                { name: 'V_REP', position: 1, dataType: 'NUMBER', inOut: 'IN' },
                { name: 'V_CODIGO', position: 2, dataType: 'NUMBER', inOut: 'IN' }
            ]
        };

        const result = generateFnMapper([fn]);
        assert.ok(result.fn_existeConcepto);
        assert.equal(result.fn_existeConcepto.fn_name, 'MOD_FUNCIONES.EXISTE_CONCEPTO');
        assert.deepEqual(result.fn_existeConcepto.in_param, { Rep: 'V_REP', Codigo: 'V_CODIGO' });
        assert.deepEqual(result.fn_existeConcepto.out_param, { varName: 'value' });
    });

    await t.test('preserva nombres legacy y crea doble alias para retrocompatibilidad', () => {
        const proc = {
            packageName: 'MOD_NOV',
            objectName: 'SPI_HOJA_NOV',
            overload: '0',
            isFunction: false,
            arguments: [
                { name: 'VIDTIPOHOJA', position: 1, dataType: 'NUMBER', inOut: 'IN' },
                { name: 'VSALIDA', position: 2, dataType: 'VARCHAR2', inOut: 'OUT' }
            ]
        };

        const existingSpMap = {
            HojaIns: {
                sp_name: 'MOD_NOV.SPI_HOJA_NOV',
                in_param: ['vIDTIPOHOJA'],
                out_param: ['ValorSalida'],
                fileName: 'HojaCustom.txt'
            }
        };

        const result = generateSpMapper([proc], existingSpMap);
        assert.ok(result.nov_spiHojaNov, 'Debe existir el nuevo alias nov_spiHojaNov');
        assert.ok(result.HojaIns, 'Debe mantenerse el alias histórico HojaIns');
        assert.equal(result.nov_spiHojaNov.sp_name, 'MOD_NOV.SPI_HOJA_NOV');
        assert.equal(result.HojaIns.sp_name, 'MOD_NOV.SPI_HOJA_NOV');
        assert.equal(result.nov_spiHojaNov.fileName, 'HojaCustom.txt');
        assert.equal(result.HojaIns.fileName, 'HojaCustom.txt');
    });

    await t.test('preserva nombres legacy en fnmapper para retrocompatibilidad', () => {
        const fn = {
            packageName: 'MOD_FUNCIONES',
            objectName: 'EXISTE_CONCEPTO',
            overload: '0',
            isFunction: true,
            arguments: [
                { name: 'V_REP', position: 1, dataType: 'NUMBER', inOut: 'IN' }
            ]
        };

        const existingFnMap = {
            verifConcepto: {
                fn_name: 'MOD_FUNCIONES.EXISTE_CONCEPTO',
                in_param: { Rep: 'V_REP' },
                out_param: { varName: 'value' }
            }
        };

        const result = generateFnMapper([fn], existingFnMap);
        assert.ok(result.fn_existeConcepto, 'Debe existir el nuevo alias fn_existeConcepto');
        assert.ok(result.verifConcepto, 'Debe mantenerse el alias histórico verifConcepto');
        assert.equal(result.fn_existeConcepto.fn_name, 'MOD_FUNCIONES.EXISTE_CONCEPTO');
        assert.equal(result.verifConcepto.fn_name, 'MOD_FUNCIONES.EXISTE_CONCEPTO');
    });
});

