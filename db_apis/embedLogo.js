const fs = require('fs');
const path = require('path');
const assets = require('../config/assets');

async function embedLogo(pdfDoc, defaultFilename) {
    const logoPath = assets.getLogoPath(defaultFilename);
    const extension = path.extname(logoPath).toLowerCase();
    const imageBytes = fs.readFileSync(logoPath);

    if (extension === '.png') {
        return pdfDoc.embedPng(imageBytes);
    }

    if (extension === '.jpg' || extension === '.jpeg') {
        return pdfDoc.embedJpg(imageBytes);
    }

    throw new Error('LOGO_PATH debe apuntar a un archivo PNG o JPG');
}

module.exports = embedLogo;