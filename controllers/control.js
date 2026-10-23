const oracledb = require('oracledb');
const entityapi = require('../db_apis/entity');
const mapper = require('../config/mapper');
const mapperViews = require('../config/mapperViews');
const viewCatalog = require('../services/viewCatalog');
const viewapi = require('../db_apis/view');

const repomapper = require('../config/repomapper.js')
const spmapper = require('../config/spmapper');
const fnmapper = require('../config/fnmapper');
const procedureCatalog = require('../services/procedureCatalog');
const spapi = require('../db_apis/sp');
const fnapi = require('../db_apis/fn');
const repoapi = require('../db_apis/repo');

const xlsxapi = require('../db_apis/xlsx');

const boletaapi = require('../db_apis/boletaPDF');

const { PDFDocument, StandardFonts, rgb, PageSizes, BlendMode } = require('pdf-lib');
var path = require('path');
const { simpleExecute, getConnection } = require('../services/database');
const database = require('../config/database');
const embedLogo = require('../db_apis/embedLogo');
//var URL = require('url');

// private func

function getEntityArrayValues(req, entity) {
    let object = {};

    entity.forEach(element => {
        if (req.body[element] != undefined) {
            object[element] = req.body[element];
        }
    });

    return object;
}

function getEntityValues(req, entity) {
    let object = {};
    for (const key in entity) {
        if (typeof entity[key] != object) {
            if (req.body[key] != undefined) {
                //if (typeof req.body[key] == Date){}
                object[key] = req.body[key];
            }
        }
    }
    return object;
}

// public func
async function get(req, res, next) {
    try {
        let context = {};
        let result;

        context = req.query;

        let entityName = req.path.substring(1);

        if (mapper.jsonEntityMap[entityName]) {
            result = await entityapi.find(context, mapper.jsonEntityMap[entityName]);
        }

        if (result.rows.length > 0) {
            res.status(200).json(result.rows);
        } else {
            res.status(404).end();
        }

    } catch (err) {
        next(err);
    }
}

async function post(req, res, next) {
    try {
        let entityName = req.path.substring(1);

        let context = getEntityValues(req, mapper.jsonEntityMap[entityName].fields);

        let result = await entityapi.create(context, mapper.jsonEntityMap[entityName]);

        if (result) {
            result.rows = [req.body];
            res.status(result.status).json(result);
        } else {
            res.status(404).end();
        }

    } catch (err) {
        next(err);
    }
}

async function put(req, res, next) {
    try {
        let entityName = req.path.substring(1);

        let context = getEntityValues(req, mapper.jsonEntityMap[entityName].fields);

        let result = await entityapi.modify(context, mapper.jsonEntityMap[entityName]);

        if (result) {
            if (result.err) {
                res.status(result.status).end();
            } else {
                result.rows = [req.body];
                res.status(200).json(result);
            }
        } else {
            res.status(404).end();
        }

    } catch (err) {
        next(err);
    }
}

async function del(req, res, next) {
    try {
        let entityName = req.path.substring(1);

        let context = getEntityValues(req, mapper.jsonEntityMap[entityName].fields);

        let result = await entityapi.remove(context, mapper.jsonEntityMap[entityName]);

        if (result) {
            if (result.err) {
                res.status(result.status).end();
            } else {
                result.rows = [req.body];
                res.status(200).json(result);
            }
        } else {
            res.status(404).end();
        }

    } catch (err) {
        next(err);
    }
}

async function getView(req, res, next) {
    try {
        let context = {};
        let result;

        context = req.query;

        //let entityName = 'personaCargoLiq';
        let entityName = req.path.substring(6);
        //console.log(entityName);

        const viewConfig = await viewCatalog.getViewConfig(entityName);
        if (viewConfig) {
            result = await viewapi.getView(context, viewConfig);
        }

        if (result && result.rows.length > 0) {
            res.status(200).json(result.rows);
        } else {
            res.status(404).end();
        }

    } catch (err) {
        next(err);
    }
}

async function execSP(req, res, next) {
    try {
        let context = {};
        let result;

        context = req.body;
        let spName = req.path.substring(4);

        const spConfig = await procedureCatalog.getSpConfig(spName);
        if (spConfig) {
            result = await spapi.execStoreProcedure(context, spConfig);
        }

        if (result) {
            res.status(200).json(result);
        } else {
            res.status(404).end();
        }

    } catch (err) {
        next(err);
    }
}

async function execFN(req, res, next) {
    try {
        let context = {};
        let result;

        context = req.body;
        let fnName = req.path.substring(4);

        const fnConfig = await procedureCatalog.getFnConfig(fnName);
        if (fnConfig) {
            result = await fnapi.execFn(context, fnConfig);
        }

        const val = result ? res.status(200).json(result) : res.status(404).end();

        return val;

    } catch (err) {
        next(err);
    }
}

async function getProc(req, res, next) {
    try {
        const dedup = req.query && req.query.all === 'true' ? false : true;
        const result = await procedureCatalog.getAllSp({ dedup });
        const val = result ? res.status(200).json(result) : res.status(404).end();

        return val;

    } catch (err) {
        next(err);
    }
}

async function getFunc(req, res, next) {
    try {
        const result = await procedureCatalog.getAllFn();
        const val = result ? res.status(200).json(result) : res.status(404).end();

        return val;

    } catch (err) {
        next(err);
    }
}

async function getEntities(req, res, next) {
    try {

        let result = mapper.jsonEntityMap;
        const val = result ? res.status(200).json(result) : res.status(404).end();

        return val;

    } catch (err) {
        next(err);
    }
}

async function getViews(req, res, next) {
    try {

        let result = await viewCatalog.getAllViews();
        const val = result ? res.status(200).json(result) : res.status(404).end();

        return val;

    } catch (err) {
        next(err);
    }
}


async function getReps(req, res, next) {
    try {

        let result = repomapper.jsonReportes;
        const val = result ? res.status(200).json(result) : res.status(404).end();

        return val;

    } catch (err) {
        next(err);
    }
}

async function getRepo(req, res, next) {
    try {
        let context = {};
        let result;

        context = req.query;

        //let entityName = 'personaCargoLiq';
        let repoName = req.path.substring(6);
        //console.log(entityName);

        if (repomapper.jsonReportes[repoName]) {
            result = await repoapi.getRepo(context, repomapper.jsonReportes[repoName]);
        }

        if (result && result.rows.length > 0) {
            res.status(200).json(result.rows);
        } else {
            res.status(404).end();
        }

    } catch (err) {
        next(err);
    }
}

function yyyymmdd() {
    function twoDigit(n) { return (n < 10 ? '0' : '') + n; }

    var now = new Date();
    return '' + now.getFullYear() + twoDigit(now.getMonth() + 1) + twoDigit(now.getDate());
}

async function getxlsx(req, res, next) {

    let context = {};
    let result;

    context = req.query;
    let repoName = req.path.substring(6);

    if (repomapper.jsonReportes[repoName]) {
        result = await repoapi.getRepo(context, repomapper.jsonReportes[repoName]);
        let file = xlsxapi.get_file(result.rows);

        let fileName = yyyymmdd() + '_' + repoName + '.xlsx';

        res.setHeader('Content-Length', file.length);
        res.setHeader('Content-Type', 'application/xlsx');
        res.setHeader('Content-Disposition', 'attachment; filename=' + fileName);
        res.write(file);
        res.end();

    } else {
        res.status(404).end();
    }

}

async function getTXT(req, res, next) {
    try {
        let context = {};
        let result;

        context = req.query;

        let entityName = req.path.substring(5);

        const viewConfig = await viewCatalog.getViewConfig(entityName);
        if (viewConfig) {
            result = await viewapi.getView(context, viewConfig);
        }

        if (result && result.rows.length > 0) {

            let content = result.rows;
            let txt = new String();

            let ban = true;
            let fileName = '';

            content.forEach(element => {
                if (ban) {
                    if (element['NOMBREARCHIVO']) {
                        fileName = element['NOMBREARCHIVO'];
                    }
                    ban = false;
                }
                txt = txt + element['CADENA'] + '\n';
            });

            const buf = Buffer.from(txt,'latin1');
            console.log(buf.toString('binary') );

            if (!fileName) {
                fileName = yyyymmdd() + '_' + entityName + '.txt';
            }

            //res.setHeader('Content-Length', buf.length);
            //res.setHeader('Content-Type', 'application/text; charset=latin-1');
            res.setHeader('Content-Disposition', 'attachment; filename=' + fileName);            
            //res.write(buf.toString('latin1'));
            res.end(buf.toString('binary'));

        } else {
            res.status(404).end();
        }

    } catch (err) {
        next(err);
    }
}

async function getTXTipsst(req, res, next) {

    try {
        let context = {};
        let result;

        context = req.query;

        let entityName = req.path.substring(5);
        //console.log(entityName);

        const viewConfig = await viewCatalog.getViewConfig(entityName);
        if (viewConfig) {
            result = await viewapi.getView(context, viewConfig);
        }

        if (result && result.rows.length > 0) {

            let content = result.rows;
            let txt = new String();

            content.forEach(element => {
                txt = txt + element['CADENA'] + '\n';
            });

            const buf = Buffer.from(txt, 'latin1');

            let mes = result.params['Periodo'].toString();
            console.log(mes);

            let fileName = yyyymmdd() + '_' + entityName + '.' + mes;

            res.setHeader('Content-Length', buf.length);
            res.setHeader('Content-Type', 'application/text');
            res.setHeader('Content-Disposition', 'attachment; filename=' + fileName);
            res.write(buf.toString('latin1'));
            res.end();

        } else {
            res.status(404).end();
        }

    } catch (err) {
        next(err);
    }

}

async function getCursorFromSP(req, res, next) {
    try {
        let result;
        let spName = req.path.substring(11);

        const spConfig = await procedureCatalog.getSpConfig(spName);
        if (!spConfig) {
            return res.status(404).end();
        }

        let context = getEntityArrayValues(req, spConfig.in_param || []);
        const query = spapi.getSQLcall(spConfig);
        const binds = spapi.getSQLbinds(context, spConfig);

        let conn;
        let rs;

        try {
            conn = await getConnection();
            result = await conn.execute(query, binds);

            let txt = '';
            rs = result.outBinds.Cursor;
            let row;

            while ((row = await rs.getRow())) {
                txt = txt + row.toString() + '\n';
            }

            let fileName = '';
            const buf = Buffer.from(txt, 'latin1');

            if (!spConfig.fileName) {
                fileName = yyyymmdd() + '_' + spName;
            } else {
                fileName = spConfig.fileName;
            }

            res.setHeader('Content-Length', buf.length);
            res.setHeader('Content-Type', 'application/text');
            res.setHeader('Content-Disposition', 'attachment; filename=' + fileName);
            res.write(buf.toString('latin1'));
            res.end();
        } finally {
            try {
                if (rs) {
                    await rs.close();
                }
            } finally {
                if (conn) {
                    await conn.close();
                }
            }
        }

    } catch (err) {
        next(err);
    }
}

async function getBoletaPDF(req, res, next) {

    try {
        let context = {};
        let result;

        context = req.query;

        let entityName = 'jsonliq';
        //let entityName = req.path.substring(5,);
        //console.log(entityName);

        const viewConfig = await viewCatalog.getViewConfig(entityName);
        if (viewConfig) {
            result = await viewapi.getView(context, viewConfig);
        }

        //console.log(result);

        if (result && result.rows.length > 0) {

            //boletaapi.getPDF(result.rows[0].JSON);
            let json = JSON.parse(result.rows[0]['JSON']);

            let filePDF = await boletaapi.createPdf(json);

            const buf = Buffer.from(filePDF);

            //const buf = filePDF;
            let liq = json.liqcabecera.liquidacion;

            let fileName = liq.periodo + '_' + liq.tipoliq + '_' + json.liqcabecera.cargo.apellido;

            res.setHeader('Content-Length', buf.length);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=' + fileName + '.pdf');
            res.write(buf);
            res.end();

        } else {
            res.status(404).end();
        }

    } catch (err) {
        next(err);
    }

}

async function getBoletaPDF2(req, res, next) {

    try {
        let context = {};
        let result, resultcab, datosBoleta;

        context = req.query;

        let entityNameCab = 'boletaCabPie';
        const viewConfigCab = await viewCatalog.getViewConfig(entityNameCab);
        if (viewConfigCab) {
            resultcab = await viewapi.getView(context, viewConfigCab);
        }

        let entityName = 'boletaDetalle';
        const viewConfigDet = await viewCatalog.getViewConfig(entityName);
        if (viewConfigDet) {
            result = await viewapi.getView(context, viewConfigDet);
        }

        let cadenacab = '', cadenapie = '', filename = '';
        let idLiq = 0;

        if (resultcab.rows.length === 1) {
            const line = resultcab.rows[0];

            cadenacab += line['C1'] + '\n';
            cadenacab += line['C2'] + '\n';
            cadenacab += line['C3'] + '\n';
            cadenacab += line['C4'] + '\n';
            cadenacab += line['C5'] + '\n';

            idLiq = line['IDLIQ'];
            cadenapie += 'Sup. Gobierno de Tucumán  30-67542808-1' + '\n'
            cadenapie += line["HABTXT"].toString().padStart(79);
            cadenapie += line["RETTXT"].toString().padStart(19) + '\n\n';
            cadenapie += 'LIQUIDO: '.toString().padStart(79) + line["NETOTXT"].toString().padStart(19) + '\n';

            filename = line['FILENAME'];

        }

        let cadenadet = 'Cod Subcod  Descripción                      Cant        Vto            Haberes         Retenciones\n\n';

        let hab = 0, ret = 0;

        if (result && result.rows.length > 0) {

            result.rows.forEach(element => {
                cadenadet += element['CADENA'].replace('  0.00', '      ') + '\n';
                hab += element['HABERES'];
                ret += element['RETENCIONES'];
            });

            const liquid = hab - ret;
            
            cadenapie += '\nRECIBO NRO: '.padStart(77) + idLiq;

            const text = cadenacab + '\n' + cadenadet + '\n' + cadenapie;

            const textByline = text.toString().split('\n');

            const textCab = cadenacab.toString().split('\n');
            const textDet = cadenadet.toString().split('\n');
            const textPie = cadenapie.toString().split('\n');

            const pdfDoc = await PDFDocument.create()
            const fontCur = await pdfDoc.embedFont(StandardFonts.Courier)
            const fontBold = await pdfDoc.embedFont(StandardFonts.CourierBold)

            const page = pdfDoc.addPage(PageSizes.A4)
            const { width, height } = page.getSize();

            // Image

            const pngImage = await embedLogo(pdfDoc, 'Logo.png')

            const pngDims = pngImage.scale(0.2)

            page.drawImage(pngImage, {
                x: page.getWidth() / 2 - pngDims.width / 2,
                y: (page.getHeight() - 20) / 2 - pngDims.height / 2 + 145,
                width: pngDims.width,
                height: pngDims.height,
                opacity: 0.2,
                blendMode: BlendMode.SoftLight
            });

            let fontSize = 9
            let font = fontCur;

            let xpos = 30;
            let ypos = 25;
            let tempHeight = height;
            font = fontBold;

            for (let index = 0; index < textCab.length; index++) {
                const element = textCab[index];

                ypos = (tempHeight - 25) - index * fontSize;

                page.drawText(element, {
                    x: xpos,
                    y: ypos,
                    size: fontSize,
                    font: font,
                    color: rgb(0, 0, 0),
                });

            }

            page.drawLine({
                start: { x: xpos, y: ypos },
                end: { x: width - xpos, y: ypos },
                thickness: 1,
                //color: rgb(0.75, 0.2, 0.2),
                opacity: 0.50,
            });

            tempHeight = ypos;

            for (let index = 0; index < textDet.length; index++) {
                const element = textDet[index];

                font = fontCur;
                ypos = (tempHeight - index - 25) - index * fontSize;

                page.drawText(element, {
                    x: xpos,
                    y: ypos,
                    size: fontSize,
                    font: font,
                    color: rgb(0, 0, 0)
                });

            }

            tempHeight = ypos;

            for (let index = 0; index < (40 - textDet.length); index++) {
                ypos = (tempHeight - index - 25) - index * fontSize;
            }

            page.drawLine({
                start: { x: xpos, y: ypos },
                end: { x: width - xpos, y: ypos },
                thickness: 1,
                //color: rgb(0.75, 0.2, 0.2),
                opacity: 0.50
            });

            tempHeight = ypos;

            for (let index = 0; index < textPie.length; index++) {
                const element = textPie[index];

                font = fontCur;
                ypos = (tempHeight - index - 25) - index * fontSize;

                page.drawText(element, {
                    x: xpos,
                    y: ypos,
                    size: fontSize,
                    font: font,
                    color: rgb(0, 0, 0)
                });

            };

            tempHeight = ypos;

            const pdfBytes = await pdfDoc.save();

            const buf = Buffer.from(pdfBytes);

            res.setHeader('Content-Length', buf.length);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=' + filename + '.pdf');
            res.write(buf);
            res.end();

            res.status(200).end();

        } else {
            res.status(404).end();
        }

    } catch (err) {
        next(err);
    }

}

module.exports.getEntities = getEntities;
module.exports.execSP = execSP;
module.exports.execFN = execFN;
module.exports.getProc = getProc;
module.exports.getFunc = getFunc;
module.exports.getRepo = getRepo;

module.exports.getView = getView;
module.exports.getViews = getViews;
module.exports.getReps = getReps;

module.exports.get = get;
module.exports.post = post;
module.exports.put = put;
module.exports.del = del;

module.exports.getxlsx = getxlsx;
module.exports.getTXT = getTXT;

module.exports.getTXTipsst = getTXTipsst;

module.exports.getCursorFromSP = getCursorFromSP;

module.exports.getBoletaPDF = getBoletaPDF;

module.exports.getBoletaPDF2 = getBoletaPDF2;

async function saveView(req, res, next) {
    try {
        const body = req.body || {};
        const viewName = body.viewName || body.name;
        const description = body.description || body.desc || `Vista/consulta ${viewName}`;

        if (!viewName) {
            return res.status(400).json({ error: 'El nombre de la vista (viewName o name) es obligatorio' });
        }

        let configObj = body.config;

        // Opción 1: Armado automático a partir de un SELECT SQL puro
        if (typeof body.sql === 'string' && /^\s*SELECT\b/i.test(body.sql)) {
            configObj = viewCatalog.parseSqlToViewConfig(body.sql);
        } else if (typeof body.query === 'string' && /^\s*SELECT\b/i.test(body.query)) {
            configObj = viewCatalog.parseSqlToViewConfig(body.query);
        } else if (body.oracleView) {
            // Opción 2: Armado automático a partir de una tabla o vista física de Oracle
            const saved = await viewCatalog.createFromOracleView(viewName, description, body.oracleView);
            return res.status(200).json({
                status: 'ok',
                message: `Vista '${viewName}' generada automáticamente desde '${body.oracleView}' y guardada en API_VIEW_MAPPER`,
                viewName,
                config: saved.config
            });
        }

        // Opción 3: Armado estructurado manual con fields y fromClause
        if (!configObj) {
            if (body.fields) {
                configObj = {
                    fields: body.fields,
                    key: body.key || { field: Object.keys(body.fields)[0] },
                    sql: {
                        fromClause: Array.isArray(body.fromClause) ? body.fromClause : (body.sql && body.sql.fromClause ? body.sql.fromClause : []),
                        whereFields: body.whereFields || (body.sql && body.sql.whereFields ? body.sql.whereFields : {}),
                        groupClause: body.groupClause || (body.sql && body.sql.groupClause ? body.sql.groupClause : undefined)
                    }
                };
            }
        }

        if (!configObj || !configObj.fields) {
            return res.status(400).json({
                error: 'Para crear la consulta automáticamente envía "sql": "SELECT ... FROM ...", o indica "oracleView": "V_NOMBRE", o define el objeto "fields".'
            });
        }


        const saved = await viewCatalog.upsertView(viewName, description, configObj);
        res.status(200).json({
            status: 'ok',
            message: `Vista '${viewName}' guardada exitosamente en API_VIEW_MAPPER`,
            viewName,
            config: saved.config
        });
    } catch (err) {
        next(err);
    }
}

async function deleteView(req, res, next) {
    try {
        const viewName = (req.body && req.body.viewName) || req.path.substring(6);
        if (!viewName) {
            return res.status(400).json({ error: 'El nombre de la vista es obligatorio' });
        }

        await viewCatalog.deleteView(viewName);
        res.status(200).json({
            status: 'ok',
            message: `Vista '${viewName}' desactivada en API_VIEW_MAPPER`,
            viewName
        });
    } catch (err) {
        next(err);
    }
}

async function refreshViews(req, res, next) {
    try {
        viewCatalog.clearCache();
        procedureCatalog.clearCache();
        const views = await viewCatalog.getAllViews();
        res.status(200).json({
            status: 'ok',
            message: 'Caché de vistas y procedimientos reiniciada correctamente',
            totalViews: Object.keys(views).length
        });
    } catch (err) {
        next(err);
    }
}

async function seedViewsFromFile(req, res, next) {
    try {
        const result = await viewCatalog.seedViewsFromFile();
        res.status(200).json({
            status: 'ok',
            message: `Sincronización finalizada: ${result.successful} de ${result.total} vistas guardadas en API_VIEW_MAPPER`,
            ...result
        });
    } catch (err) {
        next(err);
    }
}

async function importViewsJson(req, res, next) {
    try {
        const body = req.body;
        const views = (body && (body.views || body.jsonViewMap)) ? (body.views || body.jsonViewMap) : body;
        if (!views || typeof views !== 'object' || Array.isArray(views)) {
            return res.status(400).json({ error: 'Formato inválido: se esperaba un objeto con las definiciones de las vistas' });
        }

        const viewNames = Object.keys(views);
        let total = viewNames.length;
        let successful = 0;
        let failed = 0;
        const errors = [];

        for (const name of viewNames) {
            const configObj = views[name];
            if (!configObj || typeof configObj !== 'object') continue;
            const description = configObj.description || `Vista/consulta ${name}`;
            try {
                await viewCatalog.upsertView(name, description, configObj);
                successful++;
            } catch (err) {
                failed++;
                errors.push({ viewName: name, error: err.message });
            }
        }

        res.status(200).json({
            status: 'ok',
            message: `Importación finalizada: ${successful} de ${total} vistas guardadas en API_VIEW_MAPPER`,
            total,
            successful,
            failed,
            errors
        });
    } catch (err) {
        next(err);
    }
}

async function importProceduresJson(req, res, next) {
    try {
        const body = req.body;
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return res.status(400).json({ error: 'Formato inválido: se esperaba un objeto JSON con las definiciones de procedimientos o funciones' });
        }

        const result = procedureCatalog.importProceduresFromObject(body);
        res.status(200).json({
            status: 'ok',
            message: `Importación finalizada: ${result.importedSp} SP(s) y ${result.importedFn} Función(es) registradas`,
            ...result
        });
    } catch (err) {
        next(err);
    }
}

async function syncProceduresFromOracle(req, res, next) {
    try {
        const schema = (req.body && req.body.schema) || (req.query && req.query.schema) || process.env.TARGET_SCHEMA || 'US_SUELDO';
        const targetPackage = (req.body && req.body.packageName) || (req.query && req.query.packageName) || null;
        const result = await procedureCatalog.syncAllFromOracle(schema, targetPackage);
        res.status(200).json({
            status: 'ok',
            message: `Sincronización desde Oracle (${result.schema}) completada: ${result.spCount} SPs y ${result.fnCount} Funciones descubiertas`,
            schema: result.schema,
            spCount: result.spCount,
            fnCount: result.fnCount
        });
    } catch (err) {
        next(err);
    }
}

module.exports.saveView = saveView;
module.exports.deleteView = deleteView;
module.exports.refreshViews = refreshViews;
module.exports.seedViewsFromFile = seedViewsFromFile;
module.exports.importViewsJson = importViewsJson;
module.exports.importProceduresJson = importProceduresJson;
module.exports.syncProceduresFromOracle = syncProceduresFromOracle;

