module.exports.jsonReportes = {
    resumenLiq: {
        fields: {
            IdRep: "c.idrep",
            Orden: "c.orden",
            PersonaDocumento: "p.dni",
            PersonaApellido: "P.APELLIDO",
            PersonaNombre: "P.NOMBRE",
            SujetoAporte: "sum( case when CON.IDTIPOCONCEPTO = 1 THEN li.impticket ELSE 0 END)",
            ExcentoAporte: "sum( case when CON.IDTIPOCONCEPTO in (2,7) THEN li.impticket ELSE 0 END)",
            AsignacionFamiliar: "sum( case when CON.IDTIPOCONCEPTO = 4 THEN li.impticket ELSE 0 END)",
            DescuentosLey: "sum( case when CON.IDTIPOCONCEPTO = 3 THEN li.impticket ELSE 0 END)",
            DescuentosVarios: "sum( case when CON.IDTIPOCONCEPTO = 6 THEN li.impticket ELSE 0 END) ",
            Neto: "sum( case when CON.IDTIPOCONCEPTO in (1,2,4,7) THEN li.impticket else 0 end) - sum(case when CON.IDTIPOCONCEPTO in (3,6) then li.impticket else 0 END)",
            TipoTotal: "grouping(c.orden)"
        },
        whereFields: {
            SituacionRevistaId: "c.idsitrev",
            TipoLiquidacionId: "l.idtipoliq",
            GrupoAdicionalId: "l.idgrupoadi",
            Periodo: "l.periodo",
            IdRep: "c.idrep",
        },
        key: { field: "" },
        sql: {
            fromClause: [
                "from liq l",
                "inner join liqitem li on l.idliq = li.idliq",
                "inner join cargos c on C.IDCARGO = l.idcargo",
                "inner join personas p on p.idpers = c.idpers",
                "inner join concepto con on con.idconcepto = li.idconcepto"
            ],
            groupClause: [
                "group by rollup ((c.idrep,c.orden,p.dni,P.APELLIDO,P.NOMBRE))",
                "ORDER BY c.idrep,c.orden, TipoTotal"
            ]
        }
    },
    resumenCodLiq: {
        fields: {
            IdTipoConcepto: "CON.IDTIPOCONCEPTO",
            Codigo: "CON.CODIGO",
            SubCodigo: "CON.SUBCOD",
            Descripcion: "CON.desc_boleta",
            Cantidad: "count(*)",
            Importe: "sum(li.impticket)",
            Periodo: "l.periodo",
            TipoTotal: "grouping(idtipoconcepto)+grouping(desc_boleta)+grouping(l.periodo) "
        },
        whereFields: {
            Periodo: "l.periodo",
            TipoLiquidacionId: "l.idtipoliq"
        },
        key: { field: "" },
        sql: {
            fromClause: [
                "from liq l",
                "inner join liqitem li on l.idliq = li.idliq",
                "inner join cargos c on C.IDCARGO = l.idcargo",
                "inner join personas p on p.idpers = c.idpers",
                "inner join concepto con on con.idconcepto = li.idconcepto and CON.IDTIPOCONCEPTO <> 5"
            ],
            groupClause: [
                "group by rollup((l.periodo,CON.IDTIPOCONCEPTO),(CON.CODIGO,CON.SUBCOD,CON.desc_boleta))"
            ]
        }
    },

    resumenCodIPSST: {
        fields: {
            Periodo: "c.periodo",
            TipoLiquidacionId: "c.idtipoliq",
            GrupoAdicionalId: "c.idgrupoadi",
            NombreArchivo: "c.nombre",
            Codigo: "d.CODIGO",
            SubCodigo: "d.SUBCOD",
            Descripcion: "d.desc_boleta",
            Cantidad: "COUNT(d.idliqitem)",
            Importe: "sum(d.impticket)"
        },
        whereFields: {
            Periodo: "c.periodo",
            TipoLiquidacionId: "c.idtipoliq",
            GrupoAdicionalId: "c.idgrupoadi"
        },
        key: { field: "" },
        sql: {
            fromClause: [
                "FROM ipsst_cab c",
                "INNER JOIN ipsst_det d ON D.idcab = c.idcab"
            ],
            groupClause: [
                "GROUP BY rollup((c.periodo, c.idtipoliq, c.idgrupoadi, c.nombre), (d.CODIGO, d.subcod, d.desc_boleta))"
            ]
        }
    }
};
