module.exports = {
    port: Number(process.env.PORT || process.env.HTTP_PORT || 3005),
    host: process.env.HOST || '0.0.0.0'
};
