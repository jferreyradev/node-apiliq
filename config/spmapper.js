module.exports.jsonStoreProcedure = {
    cambioPeriodo: {
        sp_name: 'MOD_CAMBIO_PERIODO.P_Cambio_Periodo',
        out_param: ['ValorSalida']
    },
    liq: {
        sp_name: 'MOD_LIQUIDACION.LIQ_PRINCIPAL',
        in_param: ['Periodo', 'GrupoRep', 'Rep', 'IdPersona', 'CargoId', 'TipoLiq', 'GrupoAdicional'],
        log: { status: false, type: 1 },
        opt:{sync: true}
    },
    transform: {
        sp_name: 'MOD_TRANS_NOV.PRINCIPAL',
        in_param: ['Periodo', 'GrupoRep', 'TipoLiq', 'GrupoAdicional'],
        log: { status: false, type: 1 },
        opt:{sync: true}
    },
    cabeceraValorCat: {
        sp_name: 'MOD_PARAM.P_DESC_CABVALCAT',
        in_param: ['Id', 'Descripcion'],
        out_param: ['ValorSalida']
    },
    descValorCat: {
        sp_name: 'MOD_PARAM.P_DESC_VALORCATEGORIA',
        in_param: ['Id', 'Descripcion', 'IdCabecera'],
        out_param: ['ValorSalida']
    },
    valorCat: {
        sp_name: 'MOD_PARAM.P_VALORCATEGORIA',
        in_param: ['Id', 'IdDesc', 'Cat', 'Valor'],
        out_param: ['ValorSalida']
    },
    cabeceraEscalaSalarial: {
        sp_name: 'MOD_PARAM.P_ESCALA',
        in_param: ['Id', 'Descripcion'],
        out_param: ['ValorSalida']
    },
    escalaSalarial: {
        sp_name: 'MOD_PARAM.P_ESCALASALARIAL',
        in_param: ['Id', 'IdCabecera', 'Cat', 'Descripcion', 'Detalle', 'Importe'],
        out_param: ['ValorSalida']
    },
    cabeceraValorFijo: {
        sp_name: 'MOD_PARAM.P_DESC_VALORFIJO',
        in_param: ['Id', 'Descripcion'],
        out_param: ['ValorSalida']
    },
    valorFijo: {
        sp_name: 'MOD_PARAM.P_VALORUNICO',
        in_param: ['Id', 'Descripcion', 'Valor', 'IdCabecera'],
        out_param: ['ValorSalida']
    },
    concepto: {
        sp_name: 'MOD_PARAM.P_CONCEPTO',
        in_param:
            ['Id', 'Codigo', 'SubCodigo', 'DescBreve', 'DescBoleta',
                'TipoConcepto', 'AcumRem', 'AcumJub', 'AcumOs',
                'Basico', 'Ticket', 'Bonificable', 'CalculaPersona',
                'DeduceJubilacion', 'DeducePension', 'Especial',
                'Reliquida', 'Observacion', 'AcumGan'
            ],
        out_param: ['ValorSalida']
    },
    histNomenclador: {
        sp_name: 'MOD_PARAM.P_HIST_NOMENCLADOR',
        in_param: ['Id', 'FechaInicio', 'FechaFin', 'IdNomenclador', 'IdEscala'],
        out_param: ['ValorSalida']
    },
    histConcepto: {
        sp_name: 'MOD_PARAM.P_HIST_CONCEPTO',
        in_param: ['Id', 'IdConcepto', 'Operacion'],
        out_param: ['ValorSalida']
    },
    histValUnico: {
        sp_name: 'MOD_PARAM.P_HIST_VALUNICO',
        in_param: ['Id', 'IdValorUnico', 'Operacion'],
        out_param: ['ValorSalida']
    },
    histValCat: {
        sp_name: 'MOD_PARAM.P_HIST_VALCATEGORIA',
        in_param: ['Id', 'IdDesc', 'Operacion'],
        out_param: ['ValorSalida']
    },
    generaFormula: {
        sp_name: 'SP_GENERAR_FORMULAS',
        in_param: ['Id', 'Condicion', 'Accion', 'Detalle', 'IdConcepto', 'DescripcionCorta'],
        out_param: ['ValorSalida', 'ValorError']
    },
    generaPrimitiva: {
        sp_name: 'SP_GENERAR_PRIMITIVAS',
        in_param: ['Id', 'Nombre', 'Descripcion', 'Cabecera', 'Cuerpo', 'Pie'],
        out_param: ['ValorSalida', 'ValorError']
    },
    importaHistNomenclador: {
        sp_name: 'MOD_PARAM.P_IMPORTA_HIST_NOM',
        in_param: ['HistIdOrigen', 'HistIdDestino'],
        out_param: ['ValorSalida']
    },
    importaHistNom: {
        sp_name: 'MOD_PARAM.P_IMPORTA_HIST_NOM',
        in_param: ['HistIdOrigen', 'HistIdDestino'],
        out_param: ['ValorSalida']
    },
    inseraHistNom: {
        sp_name: 'MOD_PARAM.P_IMPORTA_HIST_NOM',
        in_param:['Rep','Te','IdNom'],
        out_param: ['ValorSalida']
    },
    cargaLiqJSON: {
        sp_name: 'MOD_REPORTES.CARGA_JSNOLIQ',
        in_param: ['Periodo', 'GrupoRep', 'Rep', 'IdPersona', 'CargoId', 'TipoLiq', 'GrupoAdicional']
    },
    djPrevIncluyeLiqs: {
        sp_name: 'PKG_DDJJ_PREVISIONAL.INCLUYE_TIPOLIQ_PERIODOAPLIC',
        in_param: ['PeriodoDDJJ', 'TipoLiquidacionId', 'GrupoAdicionalId', 'ReparticionId', 'PeriodoLiq'],
        out_param: ['ValorSalida', 'ValorError']
    },
    djPrevExcluyeLiqs: {
        sp_name: 'PKG_DDJJ_PREVISIONAL.EXCLUYE_TIPOLIQ_PERIODOAPLIC',
        in_param: ['PeriodoDDJJ', 'TipoLiquidacionId', 'GrupoAdicionalId', 'ReparticionId', 'PeriodoLiq'],
        out_param: ['ValorSalida', 'ValorError']
    },
    djPrevCargaResumen: {
        sp_name: 'PKG_DDJJ_PREVISIONAL.CARGA_RESUMEN',
        in_param: ['PeriodoDDJJ'],
        out_param: ['ValorSalida', 'ValorError']
    },
    djPrevCargaDDJJ: {
        sp_name: 'PKG_DDJJ_PREVISIONAL.CARGA_DDJJ',
        in_param: ['PeriodoDDJJ'],
        out_param: ['ValorSalida', 'ValorError']
    },
    archivoIPSST: {
        sp_name: 'mod_exportacion.GENERA_ARCHIVO_IPSST ',
        in_param: ['Periodo', 'TipoLiquidacionId', 'GrupoAdicionalId']
    },
    archivoIPSSTddjj: {
        sp_name: 'mod_exportacion.GENERA_ARCHIVO_IPSST_DDJJ ',
        in_param: ['Periodo']
    },
    generaArchivoAcred: {
        sp_name: 'mod_exportacion.GENERA_ARCHIVO_ACRED ',
        in_param: ['Periodo', 'TipoLiquidacionId', 'GrupoAdicionalId']
    },
    estableceNoLey: {
        sp_name: 'MOD_FUNCIONES.ESTABLECE_NOLEY',
        in_param: ['Dni', 'Tipo', 'Periodo'],
        out_param: ['ValorSalida', 'ValorError']
    },
    eliminaNoLey: {
        sp_name: 'MOD_FUNCIONES.ELIMINA_NOLEY',
        in_param: ['Dni'],
        out_param: ['ValorSalida', 'ValorError']
    },
    generaAcredBco: {
        sp_name: 'MOD_ACREDITACION.P_GENERACION_ACRED_BCO',
        in_param: ['Periodo', 'TipoLiq', 'GrupoAdicional', 'ValorFijo', 'Cuotas'],
        out_param: ['ValorError']
    },
    cursorArchivoBco: {
        sp_name: 'MOD_ACREDITACION.C_ARCHIVO_BCO',
        in_param: ['Periodo', 'TipoLiq', 'GrupoAdicional', 'Cuotas'],
        out_param: ['Cursor'],
        fileName: 'AcredBco.txt'
    },
    totalArchivoBco: {
        sp_name: 'MOD_ACREDITACION.P_ARCHIVO_BCO_TOT',
        in_param: ['Periodo', 'TipoLiq', 'GrupoAdicional', 'Cuota'],
        out_param: ['Cantidad', 'Total']
    },
    repTeNomenclador:{
        sp_name: 'MOD_PARAM.P_REPTENOMENCLADOR',
        in_param: ['ReparticionId','TipoEmpleoId','NomencladorId','Operacion'],
        out_param: ['ValorSalida']
    },
    eliminaTipoEmpleo:{
        sp_name: 'MOD_MAESTROS.P_ELIMINA_TIPO_EMPLEO',
        in_param: ['Id'],
        out_param: ['ValorSalida', 'ValorError']
    },
    eliminaTipoLiq:{
        sp_name: 'MOD_MAESTROS.P_ELIMINA_TIPO_LIQ',
        in_param: ['Id'],
        out_param: ['ValorSalida', 'ValorError']
    },
    eliminaSitRev:{
        sp_name: 'MOD_MAESTROS.P_ELIMINA_SIT_REV',
        in_param: ['Id'],
        out_param: ['ValorSalida', 'ValorError']
    },
    generaResumenLiq:{
        sp_name: 'MOD_REPORTES.carga_resumenliq',
        in_param:['IdLiq','Periodo','TipoLiquidacionId', 'GrupoAdicionalId', 'GrupoRep', 'Rep']
    },
    eliminaTipoRev: {
        sp_name: "MOD_MAESTROS.P_ELIMINA_TIPO_REV",
        in_param: ["Id"],
        out_param: ["ValorSalida", "ValorError"]
    },
    estadoBoleta:{
        sp_name: "MOD_REPORTES.ESTABLECE_CONF_BOLETA",
        in_param:["IdLiq", "IdEstado"],
        out_param: ["ValorSalida", "ValorError"]
    },
    nuevoUsuario:{
        sp_name: "MOD_SEG.NUEVO_USUARIO",
        in_param:["DNI", "Usuario", "Clave","Mail", "Estado", "Rol", "App"],
        out_param: ["ValorSalida","ValorError"]
    },
    nuevoLog:{
        sp_name: "MOD_SEG.NUEVO_LOG",
        in_param:["Usuario", "Text"],
        out_param: ["ValorSalida","ValorError"]
    },
    setBoleta:{
        sp_name: "MOD_SEG.SET_CONFBOLETA",
        in_param:["IdLiq", "Estado"],
        out_param: ["ValorSalida","ValorError"]
    },
    setEstadoUsuario:{
        sp_name: "MOD_SEG.ESTADO_USUARIO",
        in_param:["IdUsuario", "Estado"],
        out_param: ["ValorSalida","ValorError"]
    },
     setClaveUsuario:{
        sp_name: "MOD_SEG.CLAVE_USUARIO",
        in_param:["IdUsuario", "Clave"],
        out_param: ["ValorSalida","ValorError"]
    },
     setRolUsuario:{
        sp_name: "MOD_SEG.SET_ROL_USUARIO",
        in_param:["IdUsuario", "IdRol"],
        out_param: ["ValorSalida","ValorError"]
    },
    NovVariasIns:{
        sp_name: "MOD_NOV.SPI_NOV_VARIAS",
        in_param:["vIDREP", "vORDEN", "vCOD", "vSUBCOD", "vP1", "vP2", "vVTO", "vIMP", "vIDHOJANOV", "vPERIODO"],
        out_param: ["ValorSalida","ValorError", "vErrorMsg"]
    },
    NovVariasUpd:{
        sp_name: "MOD_NOV.SPU_NOV_VARIAS",
        in_param:["vIDNOV","vIDREP", "vORDEN", "vCOD", "vSUBCOD", "vP1", "vP2", "vVTO", "vIMP", "vIDHOJANOV", "vPERIODO", "vFECHAGRAB", "vIDESTADOREG"],
        out_param: ["ValorSalida","ValorError", "vErrorMsg"]
    },
    NovVariasDel:{
        sp_name: "MOD_NOV.SPD_NOV_VARIAS",
        in_param:["vIDNOV"],
        out_param: ["ValorSalida","ValorError", "vErrorMsg"]
    },
    HojaIns:{
        sp_name: "MOD_NOV.SPI_HOJA_NOV",
        in_param:["vIDTIPOHOJA", "vPERIODO", "vIDTIPOLIQ", "vIDGRUPOADI", "vIDESTADOHOJA", "vIDTIPOCARGA"],
        out_param: ["ValorSalida","ValorError", "vErrorMsg"]
    },
    HojaUpdEstado:{
        sp_name: "MOD_NOV.SPU_HOJA_NOV_ESTADO",
        in_param:["vIDHOJANOV", "vIDESTADOHOJA"],
        out_param: ["ValorSalida","ValorError", "vErrorMsg"]
    },
    HojaUpd:{
        sp_name: "MOD_NOV.SPU_HOJA_NOV",
        in_param:["vIDHOJANOV","vIDTIPOHOJA", "vPERIODO", "vIDTIPOLIQ", "vIDGRUPOADI", "vIDESTADOHOJA", "vIDTIPOCARGA","vFECHAALTA"],
        out_param: ["ValorSalida","ValorError", "vErrorMsg"]
    },
    HojaDel:{
        sp_name: "MOD_NOV.SPD_HOJA_NOV",
        in_param:["vIDHOJANOV"],
        out_param: ["ValorSalida","ValorError", "vErrorMsg"]
    },    
    NovAltasIns:{
        sp_name: "MOD_NOV.SPI_NOV_ALTAS",
        in_param:["vREP", "vORD", "vAFI", "vDNI", "vCUIL", "vAPE", "vNOM", "vSEXO", "vTE", "vCC", "vCAT", "vANTIG", "vVTO", "vTITULO", "vDIF_CAT", "vAJUB", "vIDHOJANOV", "vPERIODO"],
        out_param: ["ValorSalida","ValorError", "vErrorMsg"]
    },
    NovAltasUpd:{
        sp_name: "MOD_NOV.SPU_NOV_ALTAS",
        in_param:["vIDNOV","vREP", "vORD", "vAFI", "vDNI", "vCUIL", "vAPE", "vNOM", "vSEXO", "vTE", "vCC", "vCAT", "vANTIG", "vVTO", "vTITULO", "vDIF_CAT", "vAJUB", "vPERIODO"],
        out_param: ["ValorSalida","ValorError", "vErrorMsg"]
    },
    NovAltasDel:{
        sp_name: "MOD_NOV.SPD_NOV_ALTAS",
        in_param:["vIDNOV"],
        out_param: ["ValorSalida","ValorError", "vErrorMsg"]
    },
    NovAltasEstado:{
        sp_name: "MOD_NOV.SPU_NOV_ALTAS_ESTADO",
        in_param:["vIDNOV", "vIDESTADOREG"],
        out_param: ["ValorSalida","ValorError", "vErrorMsg"]
    },
    NovVariasEstado:{
        sp_name: "MOD_NOV.SPU_NOV_VARIAS_ESTADO",
        in_param:["vIDNOV", "vIDESTADOREG"],
        out_param: ["ValorSalida","ValorError", "vErrorMsg"]
    },
 
    PersonaIns:{
        sp_name: "MOD_PERSONAS.SPI_PERSONA",
        in_param:["vDNI", "vAPELLIDO", "vCUIL", "vSEXO", "vFECHANAC", "vDOMICILIO", "vNRO", "vLOCALIDAD", "vPROVINCIA", "vCODPOSTAL", "vFECHAINGRESO", "vTELEFONO", "vEMAIL", "vNOMBRE",  "vIDTIPODOC", "vIDESTCIVIL", "vPAIS", "vPROVINCIA", "vLOCALIDAD", "vPISO", "vDPTO", "vCUENTA", "vCBU"],
        out_param: ["vSALIDA","vError", "vErrorMsg"]
    },   
    PersonaUpd:{
        sp_name: "MOD_PERSONAS.SPU_PERSONA",
        in_param:["vIDPERS","vDNI", "vAPELLIDO", "vCUIL", "vSEXO", "vFECHANAC", "vDOMICILIO", "vNRO", "vLOCALIDAD", "vPROVINCIA", "vCODPOSTAL", "vFECHAINGRESO", "vTELEFONO", "vEMAIL", "vNOMBRE",  "vIDTIPODOC", "vIDESTCIVIL", "vPAIS", "vPROVINCIA", "vLOCALIDAD", "vPISO", "vDPTO", "vCUENTA", "vCBU"],
        out_param: ["vSALIDA","vError", "vErrorMsg"]
    },
    PersonaDel:{
        sp_name: "MOD_PERSONAS.SPD_PERSONA",
        in_param:["vIDPERS"],
        out_param: ["vSALIDA","vError", "vErrorMsg"]
    },
    ddjjIns :{
        sp_name: "PKG_PARAM_DDJJ.SPI_PARAM_DDJJ",
        in_param:["vPERIODO", "vPERIODO_HASTA", "vAPJUB_MIN", "vAPJUB_MAX", "vAPJUB_PORC", "vCONTJUB_MAX", "vCONTJUB_PORC", "vAPOS_MIN", "vAPOS_MAX", "vCONTOS_MIN", "vCONTOS_MAX"],
        out_param: ["vSALIDA","vError", "vErrorMsg"]
    },
    ddjjUpd :{
        sp_name: "PKG_PARAM_DDJJ.SPU_PARAM_DDJJ",
        in_param:["vID","vPERIODO", "vPERIODO_HASTA", "vAPJUB_MIN", "vAPJUB_MAX", "vAPJUB_PORC", "vCONTJUB_MAX", "vCONTJUB_PORC", "vAPOS_MIN", "vAPOS_MAX", "vCONTOS_MIN", "vCONTOS_MAX"],
        out_param: ["vSALIDA","vError", "vErrorMsg"]
    },
    ddjjDel :{
        sp_name: "PKG_PARAM_DDJJ.SPD_PARAM_DDJJ",
        in_param:["vID"],
        out_param: ["vSALIDA","vError", "vErrorMsg"]
    },
    CargaFamIns:{
        sp_name: "PKG_CARGA_FAMILIAR.SPI_CARGA_FAMILIAR",
        in_param:["vIDPERS","vDNI", "vAPEYNOM", "vIDTABTIPOREL", "vFECHANAC", "vIDTABTIPOESC", "vGRADO", "vDISCAPACITADO"],
        out_param: ["vSALIDA","vError", "vErrorMsg"]
    },
    CargaFamUpd:{
        sp_name: "PKG_CARGA_FAMILIAR.SPU_CARGA_FAMILIAR",
        in_param:["vIDCARFAM","vIDPERS","vDNI", "vAPEYNOM", "vIDTABTIPOREL", "vFECHANAC", "vIDTABTIPOESC", "vGRADO", "vDISCAPACITADO"],
        out_param: ["vSALIDA","vError", "vErrorMsg"]
    },
    CargaFamDel:{
        sp_name: "PKG_CARGA_FAMILIAR.SPD_CARGA_FAMILIAR",
        in_param:["vIDCARFAM"],
        out_param: ["vSALIDA","vError", "vErrorMsg"]
    }
}
