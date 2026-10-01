const fs = require('fs');
const path = require('path');

function getLogoPath(defaultFilename) {
    if (process.env.LOGO_PATH && fs.existsSync(path.resolve(process.env.LOGO_PATH))) {
        return path.resolve(process.env.LOGO_PATH);
    }

    const candidates = [
        process.env.LOGO_PATH ? path.resolve(process.env.LOGO_PATH) : null,
        path.resolve(__dirname, '..', 'assets', defaultFilename),
        path.resolve(__dirname, '..', 'assets', 'Logo.jpg'),
        path.resolve(__dirname, '..', 'assets', 'logo.png'),
        path.resolve(__dirname, '..', 'assets', 'Logo.png'),
        path.resolve(__dirname, '..', defaultFilename)
    ].filter(Boolean);

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return path.resolve(__dirname, '..', 'assets', defaultFilename);
}

module.exports.getLogoPath = getLogoPath;