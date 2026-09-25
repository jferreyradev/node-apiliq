const mapperViews = require('../config/mapperViews');

const fs = require('fs');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const embedLogo = require('./embedLogo');

const writePdfToTmp = (pdf) => {
    const path = `${os.tmpdir()}${sep}${Date.now()}.pdf`;
    fs.writeFileSync(path, pdf);
    return path;
};

async function createPdf(json) {
    let jrep = json['liqcabecera']['reparticion'];
    let jcab = json['liqcabecera']['cargo'];
    let jliq = json['liqcabecera']['liquidacion'];
    let jres = json['liqresumen'];

    let text = '\n\n' + String.raw` REP: ${jrep.idrep} - ${jrep.desc} 
 Dirección: ${jrep.direccion} - CUIT: ${jrep.cuit} 
      
 NOMBRE: ${jcab.nombre}       APELLIDO: ${jcab.apellido}
 ORDEN:  ${jcab.ord}          AFILIADO: ${jcab.afi}         CUIL: ${jcab.cuil}
 DNI:    ${jcab.dni}          CAT: ${jcab.cat}
   
 LIQUIDACION: ${jliq.tipoliq}       PERIODO DE LIQUIDACION: ${jliq.periodo.split('/')[2]}/${jliq.periodo.split('/')[1]}`;

    text = text + '\n ' + '-'.padStart(77, '-');

    text = text + '\n\n' + 'Código'.padStart(7) + ' ' + 'Descripción'.padEnd(30) + 'Cantidad'.padStart(7) + 'VTO'.padStart(8) + 'Haberes'.padStart(12) + 'Descuentos'.padStart(12) + '\n';

    json.liqdetalle.forEach(element => {
        let vto = element['vto'].split('/');
        let cadVto = '';

        if (element['vto'] != '') {
            cadVto = element['vto'].split('/')[2].toString() + ' ' + element['vto'].split('/')[1].toString();
        }

        text = text + '\n' + element['cod'].toString().padStart(4) + element['subcod'].toString().padStart(3, '0') + ' ' + element['desc'].toString().padEnd(30) + element['cant'].toString().padStart(7) + cadVto.padStart(10);

        if (element['cod'] < 100) {
            text = text + element['imp'].toFixed(2).toString().padStart(11);
        } else {
            text = text + element['imp'].toFixed(2).toString().padStart(23);
        }
    });

    text = text + '\n\n ' + '-' .padStart(77, '-');

    let neto = 0, haberes = 0, retenciones = 0;
    json.liqresumen.forEach(element => {

        if (element['tipo'] == 1 || element['tipo'] == 2 || element['tipo'] == 7) {
            haberes = haberes + element['valor'];
        } else if (element['tipo'] == 3 || element['tipo'] == 6) {
            retenciones = retenciones + element['valor'];
        }
    });

    retenciones = retenciones * -1;

    neto = haberes - retenciones;
    text = text + `\n${haberes.toFixed(2).toString().padStart(66)}${retenciones.toFixed(2).toString().padStart(12)}
        \n${"Neto a cobrar:".padStart(65)} ${neto.toFixed(2).toLocaleString("es", {style: "currency"}).padStart(12)}`;

    const textByline = text.toString().split('\n');

    //console.log(textByline);

    const pdfDoc = await PDFDocument.create()
    const fontCur = await pdfDoc.embedFont(StandardFonts.Courier)
    const fontBold = await pdfDoc.embedFont(StandardFonts.CourierBold)

    const page = pdfDoc.addPage()
    const { width, height } = page.getSize()

    // Image

    const jpgImage = await embedLogo(pdfDoc, 'Logo.jpg')

    const jpgDims = jpgImage.scale(0.2)

    page.drawImage(jpgImage, {
        x: page.getWidth() / 2- jpgDims.width + 185 ,
        y: page.getHeight() / 2 - jpgDims.height + 410,
        width: jpgDims.width,
        height: jpgDims.height,
    })

    //

    let fontSize = 10
    let font = fontCur;
    for (let index = 0; index < textByline.length; index++) {
        const element = textByline[index];
        if (index < 10 || index == textByline.length - 1) {
            font = fontBold
            //fontSize = 10
        } else {
            font = fontCur;
            //fontSize = 10

        }
        page.drawText(element, {
            x: 10,
            y: height - index * fontSize,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0),
        })
    }

    page.drawRectangle({
        x: 10,
        y: height - 600,
        width: 480,
        height: 590,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
    });

    const pdfBytes = await pdfDoc.save();
    //const base64DataUri = await pdfDoc.saveAsBase64({ dataUri: true })
    
    return pdfBytes;

    //fs.writeFileSync(`_${jcab.apellido}_${jcab.dni}.pdf`, pdfBytes,'utf8');

}

/*function getPDF(json) {

    //json.forEach(element => {
      //  console.log(element.JSON);
        createPdf(json);
        //console.log(JSON.parse(element['JSON']));
        //createPdf(JSON.parse(element['JSON'].replace('\"', '"')));
        //createPdf(JSON.parse(element['JSON']));
        //console.log(JSON.parse(element['JSON']));
    //});
}*/


module.exports.createPdf = createPdf;