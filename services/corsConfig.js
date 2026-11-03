function getAllowedOrigins() {
    return (process.env.CORS_ORIGINS || '')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);
}

function isOriginAllowed(origin, allowedOrigins) {
    if (!origin) return true;

    return allowedOrigins.some(allowed => {
        if (allowed === '*' || allowed === origin) return true;
        if (allowed.includes('*')) {
            const regex = new RegExp('^' + allowed.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
            return regex.test(origin);
        }
        return false;
    });
}

function createCorsOptions() {
    const allowedOrigins = getAllowedOrigins();

    if (allowedOrigins.length === 0) {
        return undefined;
    }

    return {
        origin(origin, callback) {
            if (isOriginAllowed(origin, allowedOrigins)) {
                return callback(null, true);
            }

            const error = new Error('Origin not allowed by CORS');
            error.statusCode = 403;
            return callback(error);
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-File-Name',
            'X-Internal-Key',
            'X-Admin-Key',
            'x-admin-key',
            'x-project-key',
            'x-project-port'
        ]
    };
}

module.exports = createCorsOptions;