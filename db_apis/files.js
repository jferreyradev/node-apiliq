const oracledb = require('oracledb');
const { randomUUID } = require('crypto');
//const { readFile } = require('xlsx/types');
const database = require('../services/database.js');
const fm = require('./writeTempFile');

const createSql =
  `insert into jsao_files (
    id,
    file_name,
    content_type,
    blob_data
  ) values (
    TEMPFILES_SEQ.NEXTVAL,
    :file_name,
    :content_type,
    :content_buffer
  ) returning id into :id`;

async function create(fileName, contentType, contentBuffer) {
  const binds = {
    file_name: fileName,
    content_type: contentType,
    content_buffer: contentBuffer,
    id: {
      type: oracledb.NUMBER,
      dir: oracledb.BIND_OUT
    }
  };

  result = await database.simpleExecute(createSql, binds);

  return result.outBinds.id[0];
}

module.exports.create = create;


const getSql =
  `select file_name "file_name",
    dbms_lob.getlength(blob_data) "file_length",
    content_type "content_type",
    blob_data "blob_data"
  from jsao_files
  where id = :id`

async function get(id) {
  const binds = {
    id: id
  };
  const opts = {
    fetchInfo: {
      blob_data: {
        type: oracledb.BUFFER
      }
    }
  };
  const result = await database.simpleExecute(getSql, binds, opts);
  return result.rows;
}
module.exports.get = get;

async function getArrayObjects(data, parser) {
  try {
    const array = data.split("\n");
    const object = parser.row;

    const rows = [];
    const resume = {};

    array.forEach(element => {
      if (element.trimEnd().length > 1) {

        const row = {};

        for (const key in object) {

          if (Object.hasOwnProperty.call(object, key)) {
            const atrib = object[key];
            const field = element.substr(atrib.substr[0], atrib.substr[1]);

            switch (atrib.type) {
              case "number":
                row[key] = Number(field)
                if (resume[key]) resume[key] += Number(field);
                else resume[key] = Number(field);
                break;
              case "text":
                row[key] = String(field).trim();
                if (resume[key]) resume[key] += 1;
                else resume[key] = 1;
                break;
              default:
                break;
            }
          }
        }
        rows.push(row);
      }

    });

    let jsonOutput = JSON.stringify({ "resume": resume, "rows": rows });

    const uploadId = randomUUID();
    await fm.writeFile(jsonOutput, `${uploadId}.json`);

    return { "resume": resume, "rows": rows, uploadId };

  } catch (error) {

    console.log(error);
    return null;
  }

};

module.exports.getObjects = getArrayObjects;


async function crearHoja(tliq, gadi, per, thoja, tcarga, estado) {

  let createSql =
    `insert into HOJA_NOV(
        IDHOJANOV,
        IDTIPOLIQ, 
        IDGRUPOADI, 
        PERIODO, 
        IDTIPOHOJA, 
        IDTIPOCARGA, 
        IDESTADOHOJA) 
      values (
        HOJA_NOV_SEQ.nextval,
        :tipoLiq,
        :grupoAdi,
        to_date(:periodo,'dd/mm/yyyy'),
        :tipoHoja,
        :tipocarga,
        :estadoHoja
      ) returning IDHOJANOV into :idHoja`;


  const binds = {
    tipoLiq: tliq,
    grupoAdi: gadi,
    periodo: per,
    tipoHoja: thoja,
    tipoCarga: tcarga,
    estadoHoja: estado,
    idHoja: {
      type: oracledb.NUMBER,
      dir: oracledb.BIND_OUT
    }
  };

  result = await database.simpleExecute(createSql, binds);

  return result.outBinds.idHoja[0];

}

async function eliminaHoja(idhoja) {

  let sql = `delete hoja where idhojanov = :idhojanov`;

  const binds = {
    idhojanov: idhoja
  };

  database.simpleExecute(sql, binds);
  
}

async function getPeriodoActivo() {

  let sql = `select to_char(periodo,'DD/MM/YYYY') as periodo
              from tabperiodo
              where activo = 1`;

  const result = await database.simpleExecute(sql);

  return result.rows[0].PERIODO;

}


async function generaNovedadIPSST(uploadId) {

  const tempFilename = `${uploadId}.json`;

  const per = await getPeriodoActivo();

  const idHoja = await crearHoja(1, 0, per, 3, 1, 5);

  if (idHoja > 0) {
    try {
      const binds = await fm.readFile(tempFilename);

      const options = {
        autoCommit: true,
        batchErrors: true
      };

      const sql = `INSERT INTO US_SUELDO.NOVIPSST(IDNOV,CELA,CUIL,APELLIDO,COD,SUBCOD,VTO,IMP, 
                    PER_COMUN, PERIODO, IDHOJANOV, IDESTADOREG)
               VALUES (NOVIPSST_SEQ.nextval, :cela, :cuil, :apeynom, :cod, :subcod, to_date(:vto,'YYYYMM'), ROUND(:imp/100, 2),
                       to_date('${per}','dd/mm/yyyy'), to_date('${per}','dd/mm/yyyy'), ${idHoja}, 4)`;

      const connection = await database.getConnection();
      let result;

      try {
        result = await connection.executeMany(sql, binds, options);
      } finally {
        await connection.close();
      }

      let json = { 'nroHoja': idHoja, 'rowsAffected': result.rowsAffected, 'status': 200 };

      return json;

    } catch (error) {

      await eliminaHoja(idHoja);
      let json = { 'nroHoja': idHoja, 'status': 401 };
      return json;
    } finally {
      await fm.removeFile(tempFilename);

    }

  }

}

module.exports.generaNovedadIPSST = generaNovedadIPSST;