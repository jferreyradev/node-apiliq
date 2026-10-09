// Generado automáticamente por scripts/generate_mappers.js
module.exports.jsonStoreFunction = {
    "obtenerDni": {
        "fn_name": "F_OBTENER_DNI",
        "in_param": {
            "Vcuil": "VCUIL"
        },
        "out_param": {
            "varName": "value"
        }
    },
    "obtieneCategoria": {
        "fn_name": "F_OBTIENE_CATEGORIA",
        "in_param": {
            "Vidliq": "VIDLIQ"
        },
        "out_param": {
            "varName": "value"
        }
    },
    "cambioPeriodo_obtienePerActivo": {
        "fn_name": "MOD_CAMBIO_PERIODO.OBTIENE_PER_ACTIVO",
        "in_param": {},
        "out_param": {
            "varName": "value"
        }
    },
    "exportacion_genSelectLiq": {
        "fn_name": "MOD_EXPORTACION.GEN_SELECT_LIQ",
        "in_param": {
            "TableName": "P_TABLE_NAME",
            "Owner": "P_OWNER"
        },
        "out_param": {
            "varName": "value"
        }
    },
    "fn_agregarTransitoria": {
        "fn_name": "MOD_FUNCIONES.AGREGAR_TRANSITORIA",
        "in_param": {},
        "out_param": {
            "varName": "value"
        }
    },
    "fn_asociarSalario": {
        "fn_name": "MOD_FUNCIONES.ASOCIAR_SALARIO",
        "in_param": {
            "Vidpers": "VIDPERS",
            "Vidcargo": "VIDCARGO"
        },
        "out_param": {
            "varName": "value"
        }
    },
    "fn_devimportepagado": {
        "fn_name": "MOD_FUNCIONES.DEVIMPORTEPAGADO",
        "in_param": {
            "Vidpers": "VIDPERS",
            "Vfechadev": "VFECHADEV",
            "Vcod": "VCOD",
            "Vsubcod": "VSUBCOD"
        },
        "out_param": {
            "varName": "value"
        }
    },
    "fn_existeConcepto": {
        "fn_name": "MOD_FUNCIONES.EXISTE_CONCEPTO",
        "in_param": {
            "Vidrep": "VIDREP",
            "Vidte": "VIDTE",
            "Vcodigo": "VCODIGO",
            "Vsubcod": "VSUBCOD",
            "Vfecha": "VFECHA"
        },
        "out_param": {
            "varName": "value"
        }
    },
    "fn_obtieneCategoria": {
        "fn_name": "MOD_FUNCIONES.OBTIENE_CATEGORIA",
        "in_param": {
            "Vidliq": "VIDLIQ"
        },
        "out_param": {
            "varName": "value"
        }
    },
    "fn_obtieneDias": {
        "fn_name": "MOD_FUNCIONES.OBTIENE_DIAS",
        "in_param": {
            "Vidliq": "VIDLIQ"
        },
        "out_param": {
            "varName": "value"
        }
    },
    "fn_obtieneDni": {
        "fn_name": "MOD_FUNCIONES.OBTIENE_DNI",
        "in_param": {
            "Vcuil": "VCUIL"
        },
        "out_param": {
            "varName": "value"
        }
    },
    "liq_calculaConceptoliq": {
        "fn_name": "MOD_LIQUIDACION.F_CALCULA_CONCEPTOLIQ",
        "in_param": {
            "Vidcargo": "VIDCARGO",
            "Vidpers": "VIDPERS",
            "Vidconcepto": "VIDCONCEPTO"
        },
        "out_param": {
            "varName": "value"
        }
    },
    "transNov_agregarCargos": {
        "fn_name": "MOD_TRANS_NOV.AGREGAR_CARGOS",
        "in_param": {
            "Valtacargo": "VALTACARGO",
            "Vactualiza": "VACTUALIZA"
        },
        "out_param": {
            "varName": "value"
        }
    },
    "transNov_agregarPersonas": {
        "fn_name": "MOD_TRANS_NOV.AGREGAR_PERSONAS",
        "in_param": {
            "Valtapersona": "VALTAPERSONA",
            "Vactualiza": "VACTUALIZA"
        },
        "out_param": {
            "varName": "value"
        }
    },
    "transNov_buscaCargos": {
        "fn_name": "MOD_TRANS_NOV.BUSCA_CARGOS",
        "in_param": {
            "Vidrep": "VIDREP",
            "Vorden": "VORDEN",
            "Vafiliado": "VAFILIADO",
            "Vidpers": "VIDPERS",
            "Vidtipoliq": "VIDTIPOLIQ"
        },
        "out_param": {
            "varName": "value"
        }
    },
    "transNov_buscaPersona": {
        "fn_name": "MOD_TRANS_NOV.BUSCA_PERSONA",
        "in_param": {
            "Vdni": "VDNI"
        },
        "out_param": {
            "varName": "value"
        }
    },
    "djPrev_obtieneActLiq": {
        "fn_name": "PKG_DDJJ_PREVISIONAL.OBTIENE_ACT_LIQ",
        "in_param": {
            "Vidte": "VIDTE",
            "Vcodos": "VCODOS",
            "Vidrep": "VIDREP",
            "Vapjubdoc": "VAPJUBDOC",
            "VesJub": "VES_JUB"
        },
        "out_param": {
            "varName": "value"
        }
    },
    "djPrev_obtieneCodActividad": {
        "fn_name": "PKG_DDJJ_PREVISIONAL.OBTIENE_COD_ACTIVIDAD",
        "in_param": {
            "Vcuil": "VCUIL",
            "Vperiodo": "VPERIODO"
        },
        "out_param": {
            "varName": "value"
        }
    },
    "tmpPruebas_pruebaFn1": {
        "fn_name": "PKG_TMP_PRUEBAS.PRUEBA_FN1",
        "in_param": {
            "Vidpers": "VIDPERS",
            "Vdni": "VDNI"
        },
        "out_param": {
            "varName": "value"
        }
    }
};
