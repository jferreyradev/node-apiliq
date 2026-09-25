function getAllowedOrigins() {
    return (process.env.CORS_ORIGINS || '')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);
}

function createCorsOptions() {
    const allowedOrigins = getAllowedOrigins();

    if (allowedOrigins.length === 0) {
        return undefined;
    }

    return {
        origin(origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            const error = new Error('Origin not allowed by CORS');
            error.statusCode = 403;
            return callback(error);
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-File-Name', 'X-Internal-Key']
    };
}

module.exports = createCorsOptions;