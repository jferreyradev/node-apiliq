module.exports = {
    port: Number(process.env.HTTP_PORT || 3007),
    port_https: Number(process.env.HTTPS_PORT || 3009),
    host: process.env.HOST || '0.0.0.0'
};
