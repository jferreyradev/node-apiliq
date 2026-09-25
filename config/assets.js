const fs = require('fs');
const path = require('path');

function getLogoPath(defaultFilename) {
    if (process.env.LOGO_PATH) {
        return path.resolve(process.env.LOGO_PATH);
    }

    const reusableLogoPath = path.resolve(__dirname, '..', 'assets', 'logo.png');
    if (fs.existsSync(reusableLogoPath)) {
        return reusableLogoPath;
    }

    return path.resolve(__dirname, '..', defaultFilename);
}

module.exports.getLogoPath = getLogoPath;