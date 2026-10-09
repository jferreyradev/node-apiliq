module.exports = {
    port: Number(process.env.PORT || process.env.HTTP_PORT || 3005),
    port_https: Number(process.env.HTTPS_PORT || 3007),
    host: process.env.HOST || '0.0.0.0'
};
