module.exports.jsonViewMap = {    
    configServer: {
        fields: {
            IdConf: "c.idconf",
            IdRep: "c.idrep",
            Descripcion: "c.descripcion",
            Ambiente: "c.ambiente",
            Cela: "c.cela",
        },
        sql: {
            fromClause: [
                "from config_server c",
            ]
        }
    },
    aportesPat: {
        fields: {
            LiquidacionId: "liq.idliq",
            IdRep : "cargos.IDREP",
            Orden: "cargos.orden",
            Documento: 'personas.dni',
            ApeNom: "personas.APELLIDO||','||personas.NOMBRE",
            PatJub: "sum(CASE WHEN CONCEPTO.codigo = 90 THEN liqitem.IMPTICKET ELSE 0 END)",
            PatOs: "sum(CASE WHEN CONCEPTO.CODIGO = 91 THEN liqitem.IMPTICKET ELSE 0 END)",
            PatArt: "sum(CASE WHEN concepto.CODIGO = 92 THEN liqitem.IMPTICKET ELSE 0 END)",            
            Periodo: "liq.periodo",
            TipoLiquidacionId: 'liq.idtipoliq',
            GrupoAdicionalId: 'liq.idgrupoadi',
	    UniOrg: 'CARGOS.nrogral'
        },
        key: { field: "LiquidacionId" },
        sql: {
            fromClause: [
                "FROM LIQ ",
                "inner join liqitem on liqitem.IDLIQ = liq.IDLIQ",
                "inner join concepto on concepto.IDCONCEPTO = liqitem.IDCONCEPTO and concepto.IDTIPOCONCEPTO = 5",
                "INNER JOIN CARGOS ON CARGOS.IDCARGO = liq.IDCARGO",
                "inner join personas on personas.idpers = cargos.idpers"
            ],
            whereFields: {
                Periodo: "LIQ.periodo",
                TipoLiquidacionId: "LIQ.idtipoliq",
                GrupoAdicionalId: 'LIQ.IDGRUPOADI'
            },
            groupClause: [
                "group by (liq.idliq, cargos.IDREP, cargos.orden, personas.dni, personas.apellido, personas.nombre, liq.periodo, liq.idtipoliq, liq.idgrupoadi,CARGOS.nrogral)",
                "order by cargos.IDREP, cargos.orden"
            ]
        },
    },
    planillaDetLiq: {
        fields: {
            LiquidacionId: "liq.idliq",
            IdRep : "cargos.IDREP",
            Orden: "cargos.orden",
            Documento: 'personas.dni',
            ApeNom: "personas.APELLIDO||','||personas.NOMBRE",
            Codigo: "concepto.CODIGO",
            SubCodigo: "concepto.SUBCOD",
            Descripcion: "concepto.desc_boleta",
            Clase: "TO_NUMBER(SUBSTR(LPAD(liqitem.cantidad, 5, '0'),1,3))",
	    Dias: "TO_NUMBER(SUBSTR(LPAD(liqitem.cantidad, 5, '0'),4,2))",	
            Vto: "liqitem.vto",
            Importe: "liqitem.impticket",
            FechaDev: "liq.fechadev",
            Periodo: "liq.periodo",
            TipoLiquidacionId: 'liq.idtipoliq',
            GrupoAdicionalId: 'liq.idgrupoadi',
	    UniOrg: 'CARGOS.nrogral'
        },
        key: { field: "LiquidacionId" },
        sql: {
            fromClause: [
                "FROM LIQ ",
                "inner join liqitem on liqitem.IDLIQ = liq.IDLIQ",
                "inner join concepto on concepto.IDCONCEPTO = liqitem.IDCONCEPTO and concepto.IDTIPOCONCEPTO <>5",
                "INNER JOIN CARGOS ON CARGOS.IDCARGO = liq.IDCARGO",
                "inner join personas on personas.idpers = cargos.idpers"
            ],
            whereFields: {
                Periodo: "LIQ.periodo",
                TipoLiquidacionId: "LIQ.idtipoliq",
                GrupoAdicionalId: 'LIQ.IDGRUPOADI'
            }
        },
    },
    planillaRet: {
        fields: {
            LiquidacionId: "liq.idliq",
            IdRep : "cargos.IDREP",
            Orden: "cargos.orden",
            Documento: 'personas.dni',
            ApeNom: "personas.APELLIDO||','||personas.NOMBRE",
            Codigo: "concepto.CODIGO",
            SubCodigo: "concepto.SUBCOD",
            Descripcion: "concepto.desc_boleta",
            Clase: "TO_NUMBER(SUBSTR(LPAD(liqitem.cantidad, 5, '0'),1,3))",
	    Dias: "TO_NUMBER(SUBSTR(LPAD(liqitem.cantidad, 5, '0'),4,2))",
            Vto: "liqitem.vto",
            Importe: "liqitem.impticket",
            Periodo: "liq.periodo",
            TipoLiquidacionId: 'liq.idtipoliq',
            GrupoAdicionalId: 'liq.idgrupoadi',
	    UniOrg: 'CARGOS.nrogral'
        },
        key: { field: "LiquidacionId" },
        sql: {
            fromClause: [
                "FROM LIQ ",
                "inner join liqitem on liqitem.IDLIQ = liq.IDLIQ",
                "inner join concepto on concepto.IDCONCEPTO = liqitem.IDCONCEPTO and concepto.IDTIPOCONCEPTO in (3,6)",
                "INNER JOIN CARGOS ON CARGOS.IDCARGO = liq.IDCARGO",
                "inner join personas on personas.idpers = cargos.idpers"
            ]
        },
    },
    planillaRetCPA: {
        fields: {
            LiquidacionId: "liq.idliq",
            IdRep : "cargos.IDREP",
            Orden: "cargos.orden",
            Documento: 'personas.dni',
            ApeNom: "personas.APELLIDO||','||personas.NOMBRE",
            Codigo: "concepto.CODIGO",
            SubCodigo: "concepto.SUBCOD",
            Descripcion: "concepto.desc_boleta",
            Vto: "liqitem.vto",
            Importe: "liqitem.impticket",
            Periodo: "liq.periodo",
            TipoLiquidacionId: 'liq.idtipoliq',
            GrupoAdicionalId: 'liq.idgrupoadi',
	    UniOrg: 'CARGOS.nrogral'
        },
        key: { field: "LiquidacionId" },
        sql: {
            fromClause: [
                "FROM LIQ ",
                "inner join liqitem on liqitem.IDLIQ = liq.IDLIQ",
                "inner join concepto on concepto.IDCONCEPTO = liqitem.IDCONCEPTO and concepto.IDTIPOCONCEPTO in (3,6) AND concepto.codigo in (153,154,245)",
                "INNER JOIN CARGOS ON CARGOS.IDCARGO = liq.IDCARGO",
                "inner join personas on personas.idpers = cargos.idpers"
            ]
        },
    },
    planillaLey: {
        fields: {
            LiquidacionId: "liq.idliq",
            IdRep : "cargos.IDREP",
            Orden: "cargos.orden",
            Documento: 'personas.dni',
            ApeNom: "personas.APELLIDO||','||personas.NOMBRE",           
            Descripcion: "concepto.desc_boleta",           
            Importe: "liqitem.impticket",
            FechaDev: "liq.fechadev",
            Periodo: "liq.periodo",
            TipoLiquidacionId: 'liq.idtipoliq',
            GrupoAdicionalId: 'liq.idgrupoadi',
	    UniOrg: 'cargos.nrogral'
        },
        key: { field: "LiquidacionId" },
        sql: {
            fromClause: [
                "FROM LIQ ",
                "inner join liqitem on liqitem.IDLIQ = liq.IDLIQ and liqitem.ESLEY=1",
                "inner join concepto on concepto.IDCONCEPTO = liqitem.IDCONCEPTO ",
                "INNER JOIN CARGOS ON CARGOS.IDCARGO = liq.IDCARGO",
                "inner join personas on personas.idpers = cargos.idpers"
            ],
            whereFields: {
                Periodo: "LIQ.periodo",
                TipoLiquidacionId: "LIQ.idtipoliq",
                GrupoAdicionalId: 'LIQ.IDGRUPOADI'
            }
        },
    },
    resumenSueldos: {
        fields: {
            LiquidacionId: "liq.idliq",
            IdRep : "cargos.IDREP",
            Orden: "cargos.orden",
            Documento: 'personas.dni',
            ApeNom: "personas.APELLIDO||','||personas.NOMBRE",
            MesLiq: "TO_CHAR(LIQ.FECHADEV,'MM/YYYY')",
            Cat: "US_SUELDO.F_OBTIENE_CATEGORIA(LIQ.IDLIQ)",
            HabConAp: "ROUND(sum(CASE WHEN CONCEPTO.IDTIPOCONCEPTO = 1 THEN liqitem.IMPTICKET ELSE 0 END),2)",
            HabSinAp: "ROUND(sum(CASE WHEN CONCEPTO.IDTIPOCONCEPTO = 2 THEN liqitem.IMPTICKET ELSE 0 END),2)",
            AsignFam: "ROUND(sum(CASE WHEN CONCEPTO.IDTIPOCONCEPTO = 4 THEN liqitem.IMPTICKET ELSE 0 END),2)",
            DescLey: "ROUND(sum(CASE WHEN CONCEPTO.IDTIPOCONCEPTO = 3 THEN liqitem.IMPTICKET ELSE 0 END),2)",
            DescVarios: "ROUND(sum(CASE WHEN CONCEPTO.IDTIPOCONCEPTO = 6 THEN liqitem.IMPTICKET ELSE 0 END),2)",
            Neto: "ROUND(sum( case when CONCEPTO.IDTIPOCONCEPTO in (1,2,4) THEN liqitem.IMPTICKET else liqitem.IMPTICKET*(-1) END),2)",
            Periodo: "liq.periodo",
            TipoLiquidacionId: 'liq.idtipoliq',
            GrupoAdicionalId: 'liq.idgrupoadi',
	    UniOrg: 'CARGOS.nrogral'
        },
        key: { field: "LiquidacionId" },
        sql: {
            fromClause: [
                "FROM LIQ ",
                "inner join liqitem on liqitem.IDLIQ = liq.IDLIQ",
                "inner join concepto on concepto.IDCONCEPTO = liqitem.IDCONCEPTO and CONCEPTO.IDTIPOCONCEPTO NOT IN (5,7) ",
                "INNER JOIN CARGOS ON CARGOS.IDCARGO = liq.IDCARGO",
                "inner join personas on personas.idpers = cargos.idpers"
            ],
            whereFields: {
                Periodo: "LIQ.periodo",
                TipoLiquidacionId: "LIQ.idtipoliq",
                GrupoAdicionalId: 'LIQ.IDGRUPOADI'
            },
            groupClause: [
                "group by (liq.idliq, cargos.IDREP, cargos.orden, personas.dni, personas.apellido, personas.nombre, liq.periodo, LIQ.FECHADEV, liq.idtipoliq, liq.idgrupoadi, US_SUELDO.F_OBTIENE_CATEGORIA(LIQ.IDLIQ), CARGOS.nrogral)",
                "order by cargos.IDREP, cargos.orden, LIQ.PERIODO, LIQ.FECHADEV"
            ]
        },
    },
    resumenSueldosComp: {
        fields: {
            LiquidacionId: "liq.idliq",
            IdRep : "cargos.IDREP",
            Orden: "cargos.orden",
            Documento: 'personas.dni',
            ApeNom: "personas.APELLIDO||','||personas.NOMBRE",
            MesLiq: "TO_CHAR(LIQ.FECHADEV,'MM/YYYY')",
            Cat: "US_SUELDO.F_OBTIENE_CATEGORIA(LIQ.IDLIQ)",
            HabConAp: "ROUND(sum(CASE WHEN CONCEPTO.IDTIPOCONCEPTO = 1 THEN liqitem.IMPTICKET ELSE 0 END),2)",
            InasistRem: "ROUND(sum(case when CONCEPTO.CODIGO = 160 and CONCEPTO.SUBCOD = 0 then liqitem.impticket else 0 end),2)",
            HabConAp2: "ROUND( sum(case when CONCEPTO.IDTIPOCONCEPTO = 1 THEN liqitem.impticket ELSE 0 END) - sum (case when CONCEPTO.CODIGO in (160, 205) and CONCEPTO.SUBCOD = 0 then liqitem.impticket else 0 end) ,2)",
            HabSinAp: "ROUND(sum(CASE WHEN CONCEPTO.IDTIPOCONCEPTO = 2 THEN liqitem.IMPTICKET ELSE 0 END),2)",
            TotalHab:"ROUND(sum(CASE WHEN CONCEPTO.IDTIPOCONCEPTO in (1, 2) THEN liqitem.IMPTICKET ELSE 0 END),2)",
            AsignFam: "ROUND(sum(CASE WHEN CONCEPTO.IDTIPOCONCEPTO = 4 THEN liqitem.IMPTICKET ELSE 0 END),2)",
            DescLey: "ROUND(sum(CASE WHEN CONCEPTO.IDTIPOCONCEPTO = 3 THEN liqitem.IMPTICKET ELSE 0 END),2)",
            DescVarios: "ROUND(sum(CASE WHEN CONCEPTO.IDTIPOCONCEPTO = 6 THEN liqitem.IMPTICKET ELSE 0 END),2)",
            Neto: "ROUND(sum( case when CONCEPTO.IDTIPOCONCEPTO in (1,2,4) THEN liqitem.IMPTICKET else 0 END) - sum( case when CONCEPTO.IDTIPOCONCEPTO in (3,6) THEN liqitem.IMPTICKET else 0 END) ,2)",
            Ley7991: "ROUND(sum(CASE WHEN CONCEPTO.IDTIPOCONCEPTO = 7 THEN liqitem.IMPTICKET ELSE 0 END),2)",
	    DescJubAdic: "ROUND(sum(CASE WHEN CONCEPTO.IDTIPOCONCEPTO = 3 AND  CONCEPTO.CODIGO = 169 and CONCEPTO.SUBCOD = 1 THEN liqitem.IMPTICKET ELSE 0 END),2)",
            Periodo: "liq.periodo",
            TipoLiquidacionId: 'liq.idtipoliq',
            GrupoAdicionalId: 'liq.idgrupoadi',
	    UniOrg: 'CARGOS.nrogral'
        },
        key: { field: "LiquidacionId" },
        sql: {
            fromClause: [
                "FROM LIQ ",
                "inner join liqitem on liqitem.IDLIQ = liq.IDLIQ",
                "inner join concepto on concepto.IDCONCEPTO = liqitem.IDCONCEPTO and CONCEPTO.IDTIPOCONCEPTO NOT IN (5) ",
                "INNER JOIN CARGOS ON CARGOS.IDCARGO = liq.IDCARGO",
                "inner join personas on personas.idpers = cargos.idpers"
            ],
            whereFields: {
                Periodo: "LIQ.periodo",
                TipoLiquidacionId: "LIQ.idtipoliq",
                GrupoAdicionalId: 'LIQ.IDGRUPOADI'
            },
            groupClause: [
                "group by (liq.idliq, cargos.IDREP, cargos.orden, personas.dni, personas.apellido, personas.nombre, liq.periodo, LIQ.FECHADEV, liq.idtipoliq, liq.idgrupoadi, US_SUELDO.F_OBTIENE_CATEGORIA(LIQ.IDLIQ), CARGOS.nrogral)",
                "order by cargos.IDREP, cargos.orden, LIQ.PERIODO, LIQ.FECHADEV"
            ]
        },
    },
    retencionesCargo: {
        fields: {
            CargoId: "cargos.IDCARGO",
            IdRep : "cargos.IDREP",
            Orden: "cargos.orden",
            Afiliado: "cargos.afiliado",
            Categoria: "cargos.categoria",
            SitRev: "cargos.idsitrev",
            Documento: 'personas.dni',
            ApeNom: "personas.APELLIDO||','||personas.NOMBRE",
	    UniOrg: 'CARGOS.nrogral'
        },
        key: { field: "LiquidacionId" },
        sql: {
            fromClause: [
                "FROM CARGOS",               
                "inner join personas on personas.idpers = cargos.idpers and CARGOS.idestadocargo=2"
            ]
        },
    },
    resumenCodLiq: {
        fields: {
            IdTipoConcepto: "CON.IDTIPOCONCEPTO",
            IdRep: "c.IDREP",
            Codigo: "CON.CODIGO",
            SubCodigo: "CON.SUBCOD",
            Descripcion: "CON.desc_boleta",
            Cantidad: "count(*)",
            Importe: "sum(li.impticket)",
            Periodo: "l.periodo",
	    UniOrg: 'c.nrogral',
            TipoTotal: "grouping(idtipoconcepto)+grouping(desc_boleta)+grouping(l.periodo)+grouping(c.idrep) "
        },
        sql: {
            fromClause: [
                "from liq l",
                "inner join liqitem li on l.idliq = li.idliq",
                "inner join cargos c on C.IDCARGO = l.idcargo",
                "inner join personas p on p.idpers = c.idpers",
                "inner join concepto con on con.idconcepto = li.idconcepto and CON.IDTIPOCONCEPTO <> 5"
            ],
            whereFields: {
                Periodo: "l.periodo",
                TipoLiquidacionId: "l.idtipoliq",
                GrupoAdicionalId: 'l.IDGRUPOADI',
                IdRep: 'c.IDREP'
            },
            groupClause: [
                "group by rollup((l.periodo, c.idrep,CON.IDTIPOCONCEPTO, c.nrogral),(CON.CODIGO,CON.SUBCOD,CON.desc_boleta))"
            ]
        }
    },
    resumenFdo: {
        fields: {            
            IdRep: "c.IDREP",
            Orden: "c.orden",
            PersonaDocumento: "p.dni",
            PersonaApellido: "P.APELLIDO",
            PersonaNombre: "P.NOMBRE",
            SujetoAporte: "sum(case when CON.IDTIPOCONCEPTO = 1 THEN li.imp ELSE 0 END)",
            AsignacionFamiliar: "sum( case when CON.IDTIPOCONCEPTO = 4 THEN li.imp ELSE 0 END)",
            Neto: "sum( case when CON.IDTIPOCONCEPTO in (1,2,4) THEN li.imp else li.imp*(-1) END)",
	    UniOrg: 'c.nrogral'
        },
        sql: {
            fromClause: [
                "from liq l",
                "inner join liqitem li on l.idliq = li.idliq",
                "inner join cargos c on C.IDCARGO = l.idcargo",
                "inner join personas p on p.idpers = c.idpers",
                "inner join concepto con on con.idconcepto = li.idconcepto and con.idtipoconcepto<>5"
            ],
            whereFields: {
                Periodo: 'l.PERIODO',
                TipoLiquidacionId: 'l.IDTIPOLIQ',
                GrupoAdicionalId: 'l.IDGRUPOADI',
                IdRep: 'c.IDREP'
            },
            groupClause: [
                "group by (c.idrep, c.orden, p.dni, p.apellido, P.NOMBRE, c.nrogral)"
            ]
        }
    },
    periodo: {
        fields: {
            Periodo: "tabperiodo.periodo"
        },
        sql: {
            fromClause: [
                "FROM TABPERIODO"
            ],
            whereFields: {
                Periodo: 'tabperiodo.PERIODO',
                Activo: 'tabperiodo.activo'
            },
        },
    },
    retenciones: {
        fields: {
            Importe: "sum(CASE WHEN (concepto.codigo*1000+concepto.subcod) in (153000,270000,280000,290000,300000)  THEN liqitem.IMP ELSE 0 END)",
            Periodo: "liq.periodo",
            TipoLiquidacionId: 'liq.idtipoliq',
            GrupoAdicionalId: 'liq.idgrupoadi'
        },
        key: { field: "LiquidacionId" },
        sql: {
            fromClause: [
                "FROM LIQ ",
                "inner join liqitem on LIQ.IDLIQ = liqitem.IDLIQ",
                "inner join concepto on concepto.IDCONCEPTO = liqitem.IDCONCEPTO and concepto.IDTIPOCONCEPTO in (3,6)",
                "INNER JOIN CARGOS ON CARGOS.IDCARGO = LIQ.IDCARGO",
                "inner join personas on personas.idpers = cargos.idpers"
            ],
            whereFields: {
                Periodo: 'liq.PERIODO',
                TipoLiquidacionId: 'liq.IDTIPOLIQ',
                GrupoAdicionalId: 'liq.IDGRUPOADI'
            },
            groupClause: [
                "group by (liq.periodo, liq.idtipoliq, liq.idgrupoadi)"
            ]

        },
    },
    neto: {
        fields: {
            Importe: "sum(CASE WHEN concepto.IDTIPOCONCEPTO in (1,2,4) THEN liqitem.IMP ELSE liqitem.IMP*(-1) END)",
            Periodo: "liq.periodo",
            TipoLiquidacionId: 'liq.idtipoliq',
            GrupoAdicionalId: 'liq.idgrupoadi'
        },
        key: { field: "LiquidacionId" },
        sql: {
            fromClause: [
                "FROM LIQ ",
                "inner join liqitem on liqitem.IDLIQ = liq.IDLIQ",
                "inner join concepto on concepto.IDCONCEPTO = liqitem.IDCONCEPTO and concepto.IDTIPOCONCEPTO <> 5",
                "INNER JOIN CARGOS ON CARGOS.IDCARGO = LIQ.IDCARGO",
                "inner join personas on personas.idpers = cargos.idpers"
            ],
            whereFields: {
                Periodo: 'liq.PERIODO',
                TipoLiquidacionId: 'liq.IDTIPOLIQ',
                GrupoAdicionalId: 'liq.IDGRUPOADI',
                IdTe: 'cargos.idte',
                IdSitRev: 'cargos.idsitrev'
            },
            groupClause: [
                "group by (liq.periodo, liq.idtipoliq, liq.idgrupoadi)"
            ]

        },
    },
    netoPermanentes: {
        fields: {
            Importe: "sum(CASE WHEN concepto.IDTIPOCONCEPTO in (1,2,4) THEN liqitem.IMP ELSE liqitem.IMP*(-1) END)",
            Periodo: "liq.periodo",
            TipoLiquidacionId: 'liq.idtipoliq',
            GrupoAdicionalId: 'liq.idgrupoadi'
        },
        key: { field: "LiquidacionId" },
        sql: {
            fromClause: [
                "FROM LIQ ",
                "inner join liqitem on liqitem.IDLIQ = liq.IDLIQ",
                "inner join concepto on concepto.IDCONCEPTO = liqitem.IDCONCEPTO and concepto.IDTIPOCONCEPTO <> 5",
                "INNER JOIN CARGOS ON CARGOS.IDCARGO = LIQ.IDCARGO and CARGOS.IDTE=1 AND CARGOS.IDSITREV<>4",
                "inner join personas on personas.idpers = cargos.idpers"
            ],
            whereFields: {
                Periodo: 'liq.PERIODO',
                TipoLiquidacionId: 'liq.IDTIPOLIQ',
                GrupoAdicionalId: 'liq.IDGRUPOADI',
                IdTe: 'cargos.idte',
                IdSitRev: 'cargos.idsitrev'
            },
            groupClause: [
                "group by (liq.periodo, liq.idtipoliq, liq.idgrupoadi)"
            ]

        },
    },
    resumenCodigo: {
        fields: {
            LiquidacionId: "liq.idliq",
            IdRep : "cargos.IDREP",
            Orden: "cargos.orden",
            Documento: 'personas.dni',
            ApeNom: "personas.APELLIDO||','||Personas.NOMBRE",
            Importe: "liqitem.IMP",
            Periodo: "liq.periodo",
            TipoLiquidacionId: 'liq.idtipoliq',
            GrupoAdicionalId: 'liq.idgrupoadi',
            Codigo: 'concepto.codigo',
            SubCodigo: 'concepto.subcod',
	    UniOrg: 'CARGOS.nrogral'
        },
        key: { field: "LiquidacionId" },
        sql: {
            fromClause: [
                "FROM LIQ ",
                "inner join liqitem on liqitem.IDLIQ = liq.IDLIQ",
                "inner join concepto on concepto.IDCONCEPTO = liqitem.IDCONCEPTO and concepto.IDTIPOCONCEPTO <> 5",
                "INNER JOIN CARGOS ON CARGOS.IDCARGO = LIQ.IDCARGO",
                "inner join personas on personas.idpers = cargos.idpers"
            ],

        },
    },
    resumenliq: {
        fields: {
            LiquidacionId: "liq.idliq",
            IdRep : "cargos.IDREP",
            Orden: "cargos.orden",
            Documento: 'personas.dni',
            ApeNom: "personas.APELLIDO||','||personas.NOMBRE",
            HabCAP: "sum(CASE WHEN CONCEPTO.IDTIPOCONCEPTO = 1 THEN liqitem.IMP ELSE 0 END)",
            HabSAP: "sum(CASE WHEN CONCEPTO.IDTIPOCONCEPTO = 2 THEN liqitem.IMP ELSE 0 END)",
            AsignFam: "sum(CASE WHEN concepto.IDTIPOCONCEPTO = 4 THEN liqitem.IMP ELSE 0 END)",
            Neto: "sum(CASE WHEN concepto.IDTIPOCONCEPTO in (1,2,4) THEN liqitem.IMP ELSE liqitem.IMP*(-1) END)",
	    UniOrg: 'CARGOS.nrogral',
            Periodo: "liq.periodo",
            TipoLiquidacionId: 'liq.idtipoliq',
            GrupoAdicionalId: 'liq.idgrupoadi'
        },
        key: { field: "LiquidacionId" },
        sql: {
            fromClause: [
                "FROM LIQ ",
                "inner join liqitem on liqitem.IDLIQ = liq.IDLIQ",
                "inner join concepto on concepto.IDCONCEPTO = liqitem.IDCONCEPTO and concepto.IDTIPOCONCEPTO <> 5",
                "INNER JOIN CARGOS ON CARGOS.IDCARGO = liq.IDCARGO",
                "inner join personas on personas.idpers = cargos.idpers"
            ],
            groupClause: [
                "group by (liq.idliq, cargos.IDREP, cargos.orden, personas.dni, personas.apellido, personas.nombre, liq.periodo, liq.idtipoliq, liq.idgrupoadi, CARGOS.nrogral)",
                "order by cargos.IDREP, cargos.orden"
            ]
        },
    },
    liq: {
        fields: {
            PersonaId: 'personas.idpers',
            Documento: 'personas.dni',
            Apellido: 'personas.APELLIDO',
            Nombre: 'personas.NOMBRE',
            //ApellidoYNombre: 'personas.apeynom',
            PersonaCUIL: 'personas.cuil',
            CargoId: 'cargos.idcargo',
            ReparticionId: 'cargos.IDREP',
            Orden: 'cargos.ORDEN',
            Afiliado: 'cargos.AFILIADO',
            TipoEmpleoId: 'cargos.idte',
            SituacionRevistaId: 'cargos.idsitrev',
            LiquidacionId: 'liq.idliq',
            Periodo: "liq.periodo",
            FechaDev: "liq.fechadev",
            TipoLiquidacionId: 'liq.idtipoliq',
            TipoLiquidacionDescripcion: 'tipoliquidacion.descripcion',
            GrupoAdicionalId: 'liq.idgrupoadi',
	    UniOrg: 'CARGOS.nrogral'
        },
        key: { field: "LiquidacionId" },
        sql: {
            fromClause: [
                "FROM LIQ ",
                "INNER JOIN CARGOS ON CARGOS.IDCARGO = LIQ.IDCARGO",
                "inner join tipoliquidacion on tipoliquidacion.idtipoliq = liq.idtipoliq",
                "inner join personas on personas.idpers = cargos.idpers"
            ],
        }
    },
    liqItem: {
        fields: {
            Id: 'liqitem.idliqitem',
            LiquidacionId: 'liqitem.idliq',
            ConceptoId: 'liqitem.idconcepto',
            Codigo: 'concepto.codigo',
            SubCodigo: 'concepto.subcod',
            TipoConceptoId: 'concepto.idtipoconcepto',
            Descripcion: 'liqitem.descripcion',
            Cantidad: 'liqitem.cantidad',
            Vencimiento: "to_char(liqitem.vto,'MM/YYYY')",
            Importe: 'liqitem.imp',
            ImporteTicket: 'liqitem.impticket',
            PensionAlimenticia: 'liqitem.penley',
            EsLey: 'liqitem.esley'
        },
        key: { field: "Id" },
        sql: {
            fromClause: [
                "FROM LIQ",
                "INNER JOIN LIQITEM ON LIQ.IDLIQ = LIQITEM.IDLIQ",
                "inner join concepto on concepto.idconcepto = liqitem.idconcepto"
            ],
            whereFields: {
                Periodo: "liq.periodo",
                TipoLiquidacionId: "liq.idtipoliq",
                GrupoAdicionalId: "liq.idgrupoadi",
                LiquidacionId: 'liqitem.idliq',
            }
        }
    },
    personaCargoLiq: {
        fields: {
            Id: 'liqitem.idliqitem',
            PersonaId: 'personas.idpers',
            Documento: 'personas.dni',
            Apellido: 'personas.APELLIDO',
            Nombre: 'personas.NOMBRE',
            //ApellidoYNombre: 'personas.apeynom',
            PersonaCUIL: 'personas.cuil',
            CargoId: 'cargos.idcargo',
            ReparticionId: 'cargos.IDREP',
            Orden: 'cargos.ORDEN',
            Afiliado: 'cargos.AFILIADO',
            TipoEmpleoId: 'cargos.idte',
            SituacionRevistaId: 'cargos.idsitrev',
            LiquidacionId: 'liq.idliq',
            Periodo: 'liq.periodo',
            FechaDev: 'liq.fechadev',
            TipoLiquidacionId: 'liq.idtipoliq',
            TipoLiquidacionDescripcion: 'tipoliquidacion.descripcion',
            GrupoAdicionalId: 'liq.idgrupoadi',
            LiquidacionItemId: 'liqitem.idliqitem',
            ConceptoId: 'liqitem.idconcepto',
            Codigo: 'concepto.codigo',
            SubCodigo: 'concepto.subcod',
            TipoConceptoId: 'concepto.idtipoconcepto',
            Descripcion: 'liqitem.descripcion',
            Cantidad: 'liqitem.cantidad',
            Vencimiento: "to_char(liqitem.vto,'MM/YYYY')",
            Importe: 'round(liqitem.imp,2)',
            ImporteTicket: 'round(liqitem.impticket,2)',
            PensionAlimenticia: 'liqitem.penley',
            EsLey: 'liqitem.esley',
	    UniOrg: 'CARGOS.nrogral'
        },
        key: { field: "Id" },
        sql: {
            fromClause: [
                "FROM LIQITEM",
                "INNER JOIN LIQ ON LIQ.IDLIQ = LIQITEM.IDLIQ",
                "INNER JOIN CARGOS ON CARGOS.IDCARGO = LIQ.IDCARGO",
                "inner join concepto on concepto.idconcepto = liqitem.idconcepto",
                "inner join tipoliquidacion on tipoliquidacion.idtipoliq = liq.idtipoliq",
                "inner join personas on personas.idpers = cargos.idpers"
            ]
        }
    },
    historiaConcepto: {
        fields: {
            ConceptoId: 'hist_concepto.idconcepto',
            HistoriaNomencladorId: 'hist_concepto.idhistnom',
            Codigo: 'concepto.codigo',
            SubCodigo: 'concepto.subcod',
            DescBoleta: 'concepto.desc_boleta',
            Observacion: 'concepto.observacion'
        },
        key: { field: "ConceptoId" },
        sql: {
            fromClause: [
                "FROM hist_concepto",
                "INNER JOIN concepto ON concepto.idconcepto = hist_concepto.idconcepto"
            ]
        }

    },
    historiaValorUnico: {
        fields: {
            ValorUnicoId: 'hist_valunico.idvalunico',
            HistoriaNomencladorId: 'hist_valunico.idhistnom',
            ValorUnicoDescripcion: 'valorunico.descripcion',
            ValorUnicoValor: 'valorunico.valor',
            ValorUnicoTipoId: 'valorunico.iddescfijo',
            ValorUnicoTipoDescripcion: 'desc_valorfijo.descripcion'
        },
        key: { field: "ValorUnicoId" },
        sql: {
            fromClause: [
                "FROM hist_valunico",
                "INNER JOIN valorunico ON valorunico.idvalunico = hist_valunico.idvalunico",
                "INNER JOIN desc_valorfijo ON desc_valorfijo.iddescfijo = valorunico.iddescfijo"
            ]
        }
    },
    historiaValorCategoria: {
        fields: {
            CategoriaId: 'hist_valcategoria.iddesc_valcat',
            HistoriaNomencladorId: 'hist_valcategoria.idhistnom',
            CategoriaDescripcion: 'desc_valorcategoria.descripcion',
            CategoriaTipoId: 'desc_valorcategoria.idcabvalcat',
            CategoriaTipoDescripcion: 'desc_cabvalcat.descripcion'
        },
        key: { field: "CategoriaId" },
        sql: {
            fromClause: [
                "FROM hist_valcategoria",
                "INNER JOIN desc_valorcategoria ON desc_valorcategoria.iddesc_valcat = hist_valcategoria.iddesc_valcat",
                "INNER JOIN desc_cabvalcat ON desc_cabvalcat.idcabvalcat = desc_valorcategoria.idcabvalcat"
            ]
        }
    },
    cargo: {
        fields: {
            Id: 'cargos.IDCARGO',
            PersonaId: 'cargos.IDPERS',
            PersonaDocumento: "personas.DNI",
            PersonaApellido: "personas.APELLIDO",
            PersonaNombre: "personas.NOMBRE",
            ReparticionId: "cargos.IDREP",
            ReparticionDescripcion: "reparticion.DESCRIPCION",
            Orden: "cargos.ORDEN",
            Afiliado: "cargos.AFILIADO",
            TipoEmpleoId: "cargos.IDTE",
            TipoEmpleoDescripcion: "tabtipoempleo.DESCRIPCION",
            VtoEscalafon: "cargos.VTOESC",
            Antiguedad: "cargos.ANTIG",
            SituacionRevistaId: "cargos.IDSITREV",
            SituacionRevistaDescripcion: "tabsitrevista.DESCRIPCION",
            Categoria: "cargos.CATEGORIA",
            FechaBaja: "cargos.FECHABAJA",
            EstadoCargoId: "cargos.IDESTADOCARGO",
            EstadoCargoDescripcion: "tabestadocargo.DESCRIPCION",
            TipoObraSocialId: "cargos.IDTIPOOS",
            TipoObraSocialDescripcion: "tabtipoos.DESCRIPCION",
            TipoLiquidacionId: "cargos.IDTIPOLIQ",
            TipoLiquidacionDescripcion: "tipoliquidacion.DESCRIPCION",
            Salario: "cargos.SALARIO",
	    UniOrg: 'CARGOS.nrogral'
        },
        key: {
            field: "Id"
        },
        sql: {
            fromClause: [
                "FROM personas",
                "INNER JOIN cargos ON personas.idpers = cargos.idpers",
                "INNER JOIN reparticion ON cargos.IDREP = reparticion.IDREP",
                "INNER JOIN tabtipoempleo ON cargos.IDTE = tabtipoempleo.IDTE",
                "INNER JOIN tabsitrevista ON cargos.IDSITREV = tabsitrevista.IDSITREV",
                "INNER JOIN tabestadocargo ON cargos.IDESTADOCARGO = tabestadocargo.IDESTADOCARGO",
                "INNER JOIN tabtipoos ON cargos.IDTIPOOS = tabtipoos.IDTIPOOS",
                "INNER JOIN tipoliquidacion ON cargos.IDTIPOLIQ = tipoliquidacion.IDTIPOLIQ"
            ]
        }
    },
    djPrevLiqsPeriodoDJ: {
        fields: {
            Id: "DDJJ_Liquidaciones.Id",
            PeriodoDJ: "DDJJ_Liquidaciones.periodo_ddjj",
            TipoLiquidacionId: "DDJJ_Liquidaciones.IdTipoLiq",
            TipoLiquidacionDescripcion: "TipoLiquidacion.descripcion",
            GrupoAdicionalId: "DDJJ_Liquidaciones.IdGrupoAdic",
            PeriodoLiq: "DDJJ_Liquidaciones.Periodo_Liq",
            HabCA: "DDJJ_Liquidaciones.HABCA"
        },
        key: {
            field: "Id"
        },
        sql: {
            "fromClause": [
                "FROM DDJJ_Liquidaciones",
                "INNER JOIN TipoLiquidacion ON TipoLiquidacion.IdTipoLiq = DDJJ_Liquidaciones.IdTipoLiq"
            ]
        }
    },
    djPrevTxtDDJJ: {
        fields: {
            Id: "VW_DDJJ_PRESENTACION.Id",
            Cadena: "VW_DDJJ_PRESENTACION.CADENA",
            CUIL: "VW_DDJJ_PRESENTACION.CUIL",
            PeriodoDJ: "VW_DDJJ_PRESENTACION.PERIODO"
        },
        key: {
            field: "Id"
        },
        sql: {
            fromClause: [
                "FROM VW_DDJJ_PRESENTACION"
            ]
        }
    },
    archivoIPSST: {
        fields: {
            Periodo: "ipsst_cab.PERIODO",
            TipoLiquidacionId: "ipsst_cab.IdTipoLiq",
            GrupoAdicionalId: "ipsst_cab.IdGrupoAdi",
            NombreArchivo: "ipsst_cab.NOMBRE",
            Cadena: "ipsst_det.CADENA",
            IdLiq: "ipsst_det.idliq"
        },
        key: {},
        sql: {
            fromClause: [
                "FROM ipsst_cab",
                "INNER JOIN ipsst_det ON ipsst_det.idcab = ipsst_cab.idcab"
            ]
        }
    },
    personaLista: {
        fields: {
            PersonaId: 'personas.idpers',
            Documento: 'personas.dni',
            Apellido: 'personas.APELLIDO',
            Nombre: 'personas.NOMBRE',
            Sexo: 'personas.sexo',
            PersonaCUIL: 'personas.cuil',
            Telefono: 'personas.telefono',
            TipoDocumentoId: 'personas.idtipodoc',
            TipoDocumentoSintetico: 'tabtipodoc.sintetico',
            FechaNacimiento: 'personas.FECHANAC',
            FechaIngreso: 'personas.FECHAINGRESO',
            CBU: 'personas.CBU',
            Cuenta: 'personas.CUENTA',
            CobraLey: '(case when n.idnoley is null then 1 else 0 end)'
        },
        key: { field: "Id" },
        sql: {
            fromClause: [
                "FROM personas",
                "INNER JOIN tabtipodoc ON tabtipodoc.idtipodoc = personas.idtipodoc",
                "left outer join nocobran_ley n on n.dni = personas.dni"
            ]
        }
    },
    logProcesos: {
        fields: {
            Id: "l.id",
            Estado: "(case when fin is null then 'En ejecucion' else 'Terminado' end)",
            Procedimiento: "l.sp",
            Inicio: "TO_CHAR((inicio), 'YYYY-MM-DD HH24:MI:SS')",
            Fin: "TO_CHAR((fin), 'YYYY-MM-DD HH24:MI:SS')",
            Parametros: "l.binds",
            Tipo: "l.tipo"
        },
        key: {},
        sql: {
            fromClause: [
                "from logproc l"
            ]
        }
    },
    acredDet: {
        fields: {
            Orden: 'C.ORDEN',
            Documento: 'P.DNI',
            Apellido: "(P.APELLIDO||' '|| P.NOMBRE)",
            Neto: 'ABD.NETO',
            Cuota1: 'ABD.CUOTA1',
            ValorFijo: 'ABD.VALFIJO',
            Cuenta: 'ABD.CUENTA'
        },
        key: {},
        sql: {
            fromClause: [
                "from US_SUELDO.ACRED_BCO_CAB ABC",
                "INNER JOIN US_SUELDO.ACRED_BCO_DET ABD ON ABD.IDACREDCAB = ABC.IDACREDCAB",
                "INNER JOIN US_SUELDO.PERSONAS P ON P.IDPERS = ABD.IDPERS",
                "INNER JOIN US_SUELDO.LIQ L ON L.IDLIQ = ABD.IDLIQ",
                "INNER JOIN US_SUELDO.CARGOS C ON C.IDCARGO = L.IDCARGO"
            ],
            whereFields: {
                Periodo: 'ABC.PERIODO',
                TipoLiquidacionId: 'ABC.IDTIPOLIQ',
                GrupoAdicionalId: 'ABC.IDGRUPOADI'
            },
            orderBy: 'ORDER BY C.ORDEN'
        }
    },
    acredBancoDet: {
        fields: {
            AcredDetId: "ACRED_BCO_DET.IDACREDDET",
            AcredCabId: "ACRED_BCO_DET.IDACREDCAB",
            LiquidacionId: "ACRED_BCO_DET.IDLIQ",
            PersonaId: "ACRED_BCO_DET.IDPERS",
            Orden: "CARGOS.ORDEN",
            DNI: "PERSONAS.DNI",
            Apellido: "PERSONAS.APELLIDO",
            Nombre: "PERSONAS.NOMBRE",
            Neto: "ACRED_BCO_DET.NETO",
            ValorFijo: "ACRED_BCO_DET.VALFIJO",
            Cuota: "ACRED_BCO_DET.CUOTA1",
            UltCuota: "ACRED_BCO_DET.CUOTA2",
            Cuenta: "ACRED_BCO_DET.CUENTA",
            Estado: "ACRED_BCO_DET.ESTADO"
        },
        key: {
            field: "AcredDetId"
        },
        sql: {
            fromClause: [
                "FROM ACRED_BCO_DET",
                "INNER JOIN PERSONAS ON ACRED_BCO_DET.IDPERS = PERSONAS.IDPERS",
                "INNER JOIN LIQ ON ACRED_BCO_DET.IDLIQ = LIQ.IDLIQ",
                "INNER JOIN CARGOS ON LIQ.IDCARGO = CARGOS.IDCARGO"
            ]
        }
    },
    acredBancoCab: {
        fields: {
            AcredCabId: "ACRED_BCO_CAB.IDACREDCAB",
            Periodo: "ACRED_BCO_CAB.PERIODO",
            TipoLiquidacionId: "ACRED_BCO_CAB.IDTIPOLIQ",
            GrupoAdicionalId: "ACRED_BCO_CAB.IDGRUPOADI",
            ValorFijo: "ACRED_BCO_CAB.VALOR_FIJO",
            CantCuotas: "ACRED_BCO_CAB.CANT_CUOTAS"
        },
        key: {
            field: "AcredCabId"
        },
        sql: {
            fromClause: [
                "FROM ACRED_BCO_CAB"
            ]
        }
    },
    repTeNomenclador: {
        fields: {
            ReparticionId: "REPTENOMENCLADOR.IDREP",
            ReparticionDescripcion: "REPARTICION.DESCRIPCION",
            TipoEmpleoId: "REPTENOMENCLADOR.IDTE",
            TipoEmpleoDescripcion: "TABTIPOEMPLEO.DESCRIPCION",
            NomencladorId: "REPTENOMENCLADOR.IDNOM",
            NomencladorDescripcion: "NOMENCLADOR.DESCRIPCION"
        },
        key: {},
        sql: {
            fromClause: [
                "FROM REPTENOMENCLADOR",
                "INNER JOIN REPARTICION ON REPTENOMENCLADOR.IDREP = REPARTICION.IDREP",
                "INNER JOIN TABTIPOEMPLEO ON REPTENOMENCLADOR.IDTE = TABTIPOEMPLEO.IDTE",
                "INNER JOIN NOMENCLADOR ON REPTENOMENCLADOR.IDNOM = NOMENCLADOR.IDNOM"
            ]
        }
    },
    boletas: {
        fields: {
            LiquidacionId: "r.idliq",
            PersonaId: "p.idpers",
            Documento: "p.dni",
            Apellido: "p.apellido",
            Nombre: "p.nombre",
            CargoId: "c.idcargo",
            ReparticionId: "c.idrep",
            Orden: "c.orden",
            Afiliado: "c.afiliado",
            TipoEmpleoId: "c.idte",
            Periodo: "r.periodo",
            FechaDev: "r.fechadev",
            TipoLiquidacionId: "r.idtipoliq",
            TipoLiquidacionDescripcion: "tl.descripcion",
            GrupoAdicionalId: "r.NROADICIONAL",
            Neto: "r.NETO",
            Estado: "r.IDESTADO",
	    UniOrg: 'c.nrogral'
        },
        key: {},
        sql: {
            fromClause: [
                "from resumenliq r",
                "inner join cargos c on c.IDCARGO = r.idcargo",
                "inner join personas p on p.idpers = c.idpers",
                "inner join tipoliquidacion tl on r.IDTIPOLIQ = tl.idtipoliq"
            ],
            whereFields: {
                LiquidacionId: "r.idliq",
                Documento: "p.dni",
                ReparticionId: "c.idrep",
                Orden: "c.orden",
                Periodo: "r.periodo",
                TipoLiquidacionId: "r.idtipoliq",
                GrupoAdicionalId: "r.NROADICIONAL"
            },
            orderBy: 'ORDER BY c.idrep,c.ORDEN, r.periodo, r.fechadev'
        }
    },
    boletaCabPie: {
        fields: {
            IdLiq: "l.idliq",
            c1: "rpad(r.idrep,7) || rpad(r.descripcion,35) || lpad('CUIT ' || substr(to_char(r.cuit),1,2)||'-'||substr(to_char(r.cuit),3,8)||'-'||substr(to_char(r.cuit),11,1), 57 )",
            c2: "rpad(' ',7, ' ') ||'DIRECCION ' || upper(r.direccion)",
            c3: "rpad(' ',7, ' ') ||'APELLIDO: ' || rpad(upper(p.apellido),18) || 'NOMBRE: ' || rpad(upper(p.nombre),35) ||  lpad('CUIL '|| substr(to_char(p.cuil),1,2)||'-'||substr(to_char(p.cuil),3,8)||'-'||substr(to_char(p.cuil),11,1), 21)",
            c4: "rpad(' ',7, ' ') ||rpad('ORDEN: ' ||c.ORDEN, 15) || rpad('AFILIADO: '||c.AFILIADO, 18) || rpad('CAT: '||C.CATEGORIA, 10) || rpad('INGRESO: '||to_char(p.fechaingreso,'MM/YYYY'),16) || lpad(c.idte || 1 || c.idsitrev || c.idtipoos, 33)",
            c5: "rpad(' ',7, ' ') ||rpad('LIQUIDACION '|| tl.descripcion, 77) ||'PERIODO '||to_char(l.periodo,'MM/YYYY')",
            habcap: "l.habcap",
            habsap: "l.habsap",
            habley: "l.habley",
            descley: "l.descley",
            descvarios: "l.descvarios",
            neto: "l.neto",
            habtxt: "lpad(to_char(l.habcap+l.habsap+l.habley, '9,999,990.00' ),18,' ')",
            rettxt: "lpad(to_char(l.descley + l.descvarios, '9,999,990.00' ),18,' ')",
            netotxt: "lpad(to_char(l.neto, '9,999,990.00' ),18,' ')",
            filename: "to_char(l.periodo,'MMYYYY')||'_'||substr(tl.descripcion,0,3)||'_'||upper(p.apellido)||'_'||upper(p.nombre)"
        },
        sql: {
            fromClause: [
                'from resumenliq l',
                'inner join cargos c on c.idcargo = L.IDCARGO',
                'inner join personas p on p.idpers = c.idpers',
                'inner join reparticion r on r.idrep = c.idrep',
                'inner join tipoliquidacion tl on tl.idtipoliq = l.idtipoliq'
            ],
            whereFields: {
                IdLiq: "l.idliq"
            }
        }
    },
    boletaDetalle: {
        fields: {
            IdLiq: "li.idliq",
            Cadena: `lpad(con.codigo,3,' ')||'  ' ||lpad(con.subcod,5,' ') ||' '|| rpad(li.descripcion,30,' ') || ' ' ||
            lpad(li.cantidad,7,' ') || ' ' || lpad(nvl(to_char(li.vto,'mm/yyyy'),' '),10,' ')
            ||' '||lpad(to_char(sum(case when tc.idtipoconcepto in (1,2,4,7) then li.impticket else 0 end), '9,999,990.00' ),18,' ')
            ||' '||lpad(to_char(sum(case when tc.idtipoconcepto in (3,6) then li.impticket else 0 end), '9,999,990.00' ),18,' ')`,
            Haberes: "sum(case when tc.idtipoconcepto in (1,2,4,7) then li.impticket else 0 end)",
            Retenciones: "sum(case when tc.idtipoconcepto in (3,6) then li.impticket else 0 end)"
        },
        sql: {
            fromClause: [
                "from resumenliq r",
                "inner join liqitem li on li.idliq = r.idliq",
                "inner join concepto con on con.idconcepto = li.idconcepto",
                "inner join tabtipoconcepto tc on tc.idtipoconcepto = con.idtipoconcepto and tc.idtipoconcepto <>5"
            ],
            whereFields: {
                IdLiq: "li.idliq"
            },
            groupClause: [
                "group by (li.idliq, con.codigo, con.subcod, li.cantidad, li.vto, li.descripcion, tc.idtipoconcepto)",
                "order by con.codigo, con.subcod"
            ]
        }
    },
    cuilesFaltantes: {
        fields: {
            Dni: "p.dni",
            Apellido: "p.apellido",
            Nombre: "p.nombre",
            CUIL: "rl.cuil",
            TipoLiquidacionDescripcion: "(RL.IDTIPOLIQ || ' - ' || TL.DESCRIPCION)",
            TipoLiquidacionId: "rl.idtipoliq",
            GrupoAdicionalId: "rl.idgrupoadi",
            Fechaemision: "rl.fechaemision",
            FechaDev: "rl.fechadev",
            FechaAplica: "rl.fechaaplic",
            Baja: "rl.baja",
            TipoLiquidacionId: "rl.idtipoliq"
        },
        sql: {
            fromClause: [
                "from ddjj_resumenliq rl",
                "inner join personas p on p.idpers = rl.idpers and pkg_ddjj_previsional.validacuil(rl.cuil) = 0",
                "inner join tipoliquidacion tl on rl.idtipoliq = tl.idtipoliq"
            ]
        },
        whereFields: {
            FechaAplica: "rl.fechaaplic",
            TipoLiquidacionId: "rl.idtipoliq",
            GrupoAdicionalId: "rl.idgrupoadi"
        }
    },
    conceptosNoLiq: {
        fields: {
            Orden: "c.orden",
            Documento: "p.dni",
            Apellido: "p.apellido",
            Nombre: "p.nombre",
            Codigo: "cl.codigo",
            SubCodigo: "cl.subcod",
            Param1: "cl.parm1",
            Param2: "cl.parm2",
            VTO: "cl.vto",
            Importe: "cl.importe",
            Periodo: "cl.periodo",
            TipoLiquidacionId: "c.idtipoliq",
            TipoLiquidacionDescripcion: "tl.descripcion",
            GrupoAdicionalId: "cl.idgrupoadi"
        },
        sql: {
            fromClause: [
                "FROM cargos c",
                "inner join personas p on P.IDPERS = C.IDPERS",
                "inner join conceptoliq cl on cl.idcargo = c.idcargo and fechabaja is null and idestadocargo = 1 and cl.importe>0",
                "inner join tipoliquidacion tl on tl.idtipoliq = c.idtipoliq",
                "and not exists(select l.idliq from liq l inner join liqitem li on l.idliq = li.idliq",
                "where Li.IDCONCEPTOLIQ = CL.IDCONCEPTOLIQ",
                "and L.PERIODO = cl.periodo",
                "and l.idtipoliq = c.idtipoliq",
                "and l.idcargo = c.idcargo)"
            ]
        },
        whereFields: {
            Periodo: "cl.periodo",
            TipoLiquidacionId: "c.idtipoliq",
            GrupoAdicionalId: "c.idgrupoadi"
        },
        orderBy: "order by c.orden, cl.codigo,cl.subcod"
    },
    novIPSST: {
        fields: {
            Id: 'IDNOV',
            CELA: 'CELA',
            CUIL: 'CUIL',
            Apellido: 'APELLIDO',
            Codigo: 'COD',
            Subcodigo: 'SUBCOD',
            Vencimiento: 'VTO',
            Importe: 'IMP',
            PerComun: 'PER_COMUN',
            Periodo: 'PERIODO',
            HojaId: 'IDHOJANOV',
            FechaGrabacion: 'FECHAGRABA',
            EstadoRegistro: 'IDESTADOREG'
        },
        sql: {
            fromClause: [
                "FROM NOVIPSST"
            ]
        },
        whereFields: {
            Periodo: "PERIODO",
            HojaId: "IDHOJANOV"
        }

    },
    users:{
        fields:{
            Id: 'IDUS',
            DNI: 'DNI',
            UserName: 'USUARIO',
            Password: 'CLAVE',
            email:'MAIL',
            Estado: 'IDESTADOUS',
            Rol: 'ROL',
            App: 'APP'
        },
        sql:{
            fromClause: [
                "FROM SG_USUARIO"
            ]
        }
    },
    logs:{
        fields:{
            Id: 'l.ID',
            IdUser:'l.IDUSER',
            Text: 'l.TEXT1',
            FechaHora: 'l.FECHAHORA'
        },
        sql:{
            fromClause: [
                "FROM SG_LOG_GRAL l"
            ]
        }
    },
    bajasLey: {
        fields: {
            Documento: "P.dni",
            ApeNom: "P.APELLIDO||','||P.NOMBRE",
    	    Sexo: "P.SEXO",
    	    FechaNac: "P.FECHANAC",
     	    Edad: "floor(months_between(NL.PERIODO, P.FECHANAC) /12)"
        },        
        sql: {
            fromClause: [
                "FROM US_SUELDO.personas P ",
                "inner join US_SUELDO.NOCOBRAN_LEY NL ON NL.DNI = P.DNI"
            ],
            whereFields: {
                Periodo: "NL.periodo"
            }
        }
    },
    resumenCargos:{
        fields:{
            LiquidacionId: "l.idliq",
            IdRep : "c.IDREP",
            Orden: "c.orden",
            Documento: 'p.dni',
            PersonaCUIL: 'p.cuil',
            Apellido: "p.apellido",
            Nombre: "p.nombre",
            FechaNac: "P.FECHANAC",
            Sexo: "P.SEXO",
            Categoria: "c.CATEGORIA",
            SituacionRevistaId: "c.IDSITREV",
            Titulo: "(select MAX(SUBSTR(LI.CANTIDAD,1,3)/10 ) from liqitem li where li.idliq = l.idliq and li.IDCONCEPTO = 7  )",
            TituloEspecial: "(select MAX(SUBSTR(LI.CANTIDAD,1,3)/10 ) from liqitem li where li.idliq = l.idliq and li.IDCONCEPTO = 368  ) ",
            Antiguedad: "c.ANTIG",
            VtoEscalafon: "c.VTOESC",
            Periodo: "l.periodo",
            TipoLiquidacionId: 'l.idtipoliq',
            GrupoAdicionalId: 'l.idgrupoadi',
	    UniOrg: 'c.nrogral'
        },
        sql:{
            fromClause:[
                "from us_sueldo.cargos c ",
                "inner join US_SUELDO.PERSONAS p on p.idpers = c.IDPERS ",
                "inner join US_SUELDO.LIQ l on l.IDCARGO = c.IDCARGO and l.PERIODO= l.FECHADEV "
            ],
            whereFields:{
                Periodo: "L.periodo",
                TipoLiquidacionId: "L.idtipoliq",
                GrupoAdicionalId: "L.idgrupoadi"
            }
        }
    },
    novhaberes: {        
        fields: {
            NroReparticion: 'n.IDREP',
            ReparticionDescripcion: 'R.DESCRIPCION',
            NroBoleta: 'n.ORDEN',
            NroAfiliado: 'n.AFILIADO',
            Codigo: 'n.CODIGO',
            Subcodigo: 'n.SUBCOD',
            Clase: 'n.PARM1',
            Dias: 'n.PARM2',
            Vencimiento: 'n.VTO',
            Importe: 'n.IMPORTE',
            Documento: 'n.DNI',
            Apellido: 'n.APELLIDO',
            Nombre: 'n.NOMBRE',
            TipoEmpleoId: 'n.TE',
            TipoEmpleoDescripcion: 'te.DESCRIPCION',
            SituacionRevistaId: 'n.SITREV',
            SituacionRevistaDescripcion: 'TR.DESCRIPCION',
            TipoObraSocialId: 'n.OS',
            PPP: 'n.PPP',
            FechaGrabacion: 'n.FECHAGRAB',
            EstadoRegistro: 'n.IDESTADOREG',
            HojaId: 'n.IDHOJANOV',
            Id: 'n.IDNOVHAB'
        },
        sql: {
            fromClause: [
                "FROM US_SUELDO.NOVHABERES n ",
                "inner join US_SUELDO.REPARTICION r on r.idrep = n.idrep ",
                "inner join US_SUELDO.TABTIPOREVISTA tr on TR.IDTIPOREVISTA = N.SITREV ",
                "inner join US_SUELDO.TABTIPOEMPLEO te on TE.IDTE = N.TE " 
            ]
        }
    },
    novVarias: {
        fields: {
            Id: 'IDNOV',
            IdRep: 'IDREP',
            Orden: 'ORDEN',
            Codigo: 'COD',
            Subcodigo: 'SUBCOD',
            Param1: 'P1',
            Param2: 'P2',
            Vencimiento: 'VTO',
            Importe: 'IMP',                        
            Periodo: 'PERIODO',
            HojaId: 'IDHOJANOV',
            FechaGrabacion: 'FECHAGRAB',
            EstadoRegistro: 'IDESTADOREG'
        },
        sql: {
            fromClause: [
                "FROM NOV_VARIAS"
            ]
        },
        whereFields: {
            Periodo: "PERIODO",
            HojaId: "IDHOJANOV",
            Id: 'IDNOV'
        }
    },
    novAltas: {
        fields: {
            Id: 'IDNOV',
            IdRep: 'REP',
            Orden: 'ORD',
            Afiliado: 'AFI',
	    DNI: 'DNI',
		CUIL: 'CUIL',
		Apellido: 'APE',
		Nombre: 'NOM',
		Sexo: 'SEXO',
		TE: 'TE',
		CC: 'CC',
		CAT: 'CAT',
		Antig: 'ANTIG',
		VTO: 'VTO',
		Titulo: 'TITULO',
		DifCat: 'DIF_CAT',
		ApJub: 'AJUB',
		HojaId: 'IDHOJANOV',                  
            Periodo: 'PERIODO',           
            FechaGrabacion: 'FECHAGRAB',
            EstadoRegistro: 'IDESTADOREG'
        },
        sql: {
            fromClause: [
                "FROM NOVALTAS"
            ]
        },
        whereFields: {
            Periodo: "PERIODO",
            HojaId: "IDHOJANOV",
            Id: 'IDNOV'
        }
    },
    hojaNov: {
        fields: {
            FechaCreacion:'H.FECHAALTA',
            TipoCargaId: 'H.IDTIPOCARGA',
            TipoHojaDescripcion: 'TH.DESCRIPCION',
            EstadoHojaId: 'H.IDESTADOHOJA',
            GrupoAdicional : 'H.IDGRUPOADI',
            TipoLiquidacionId: 'H.IDTIPOLIQ',
            TipoLiquidacionDescripcion: 'TL.DESCRIPCION',
            PeriodoId: 'H.PERIODO',
            TipoHojaId: 'H.IDTIPOHOJA',
            Id: 'H.IDHOJANOV'
        },
        sql: {
            fromClause: [
                "from us_sueldo.hoja_nov h ",
                "inner join US_SUELDO.TABTIPOHOJA th on TH.IDTIPOHOJA = H.IDTIPOHOJA ",
                "inner join US_SUELDO.TIPOLIQUIDACION tl on TL.IDTIPOLIQ = H.IDTIPOLIQ "
            ]
        }
    },
    frontMenu: {
        fields: {
            Id: 'IDMENU',
            Descripcion: 'DESCRIPCION',
            Path: 'PATH'
        },
        sql: {
            fromClause: [
                "FROM US_SUELDO.SG_MENU "
            ]
        }
    },
    frontMenuRol: {
        fields: {
            IdRol: 'RM.IDROL',
            IdMenu: 'M.IDMENU',
            Descripcion: 'M.DESCRIPCION',
            Path: 'M.PATH'
        },
        sql: {
            fromClause: [
		"FROM US_SUELDO.SG_MENU M ",
		"inner join US_SUELDO.SG_ROLES_MENU RM on RM.IDMENU = M.IDMENU ",
		"inner join US_SUELDO.SG_ROLES r on R.IDROL = RM.IDROL"
            ]
        },
        whereFields: {
            IdRol: "m.IDROL"
        }
    },
    roles: {
        fields: {
            IdRol: 'r.IDROL',            
            Descripcion: 'r.DESCRIPCION'
        },
        sql: {
            fromClause: [
		"FROM US_SUELDO.SG_ROLES r  "
            ]
        },
        whereFields: {
            IdRol: "r.IDROL"
        }
    },
    acredBco: {
        fields: {
            Cadena: "a.cadena"
        },        
        sql: {
            fromClause: [
                "FROM us_sueldo.ACRED_ARCHIVO a ",
                "inner join us_sueldo.liq l on l.idliq = a.idliq"
            ],
            whereFields: {
		Periodo: 'l.PERIODO',
                TipoLiquidacionId: 'l.IDTIPOLIQ',
                GrupoAdicionalId: 'l.IDGRUPOADI'
            }
        }
    },
    resumenAcredBco:{
	fields: {
	    Ley: 'a.ESLEY', 
	    Bloq: 'a.BLOQUEADO', 
	    Haberes: 'sum(a.HABERES)', 
	    Reten: 'sum(RETEN)', 
	    Neto: 'sum(NETO)',
	    Cantidad: 'count(idliq)'
        },        
        sql: {
            fromClause: [
                "FROM US_SUELDO.ACRED_RESUMEN a ",
		"inner join liq l on l.idliq = a.idliq and a.cbu <> 0 "
            ],
            whereFields: {
		Periodo: 'l.PERIODO',
                TipoLiquidacionId: 'l.IDTIPOLIQ',
                GrupoAdicionalId: 'l.IDGRUPOADI'
            },
	    groupClause: [
                "group by a.ESLEY, a.BLOQUEADO"
            ]
        }
    },
     txtIPSST:{
	    fields: {		    
		    Cadena: 't.cadena'
	        },        
        sql: {
            fromClause: [
                "from us_sueldo.ipsst_det t "
            ],
            whereFields: {
		idCab: 't.idcab'
            }
        }
    },
    resumenIPSST: {
	fields: {		    
		TipoLiquidacionId: 'l.IDTIPOLIQ', 
		GrupoAdicionalId: 'L.IDGRUPOADI', 
		Periodo: 'L.PERIODO', 
		FechaDev: 'L.FECHADEV', 
		Codigo: 'T.CODIGO', 
		SubCod: 'T.SUBCOD', 
		DescBoleta: 'T.DESC_BOLETA', 
		Importe: 'sum(t.impticket)',
		IdCab: 't.idcab'
	        },        
        sql: {
            fromClause: [
                "from us_sueldo.ipsst_det t ",
		"inner join us_sueldo.liq l on l.idliq = t.idliq "
            ],
            whereFields: {
		Periodo: 'l.PERIODO',
                TipoLiquidacionId: 'l.IDTIPOLIQ',
                GrupoAdicionalId: 'l.IDGRUPOADI'
            },
	    groupClause: [
                "group by (L.IDTIPOLIQ, L.IDGRUPOADI, L.PERIODO, L.FECHADEV, T.CODIGO, T.SUBCOD, T.DESC_BOLETA, t.idcab) ",
		"order by l.idtipoliq, l.idgrupoadi, L.PERIODO, l.fechadev, t.codigo, t.subcod"
            ]
        }
    }	
}
