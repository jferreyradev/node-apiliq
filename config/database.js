module.exports = {
  dbPool: {
    user: process.env.USERDB,
    password: process.env.PASSWORD,
    //connectString: process.env.DB || "200.55.244.26:1521/LIQUID",
    //connectString: process.env.DB || "trancas.ddns.net:1521/LIQUID",
    //connectString: process.env.DB || "www.serverdesa.duckdns.org:1521/orcl",
    //connectString: process.env.DB || "localhost:1521/orcl",
    connectionString : process.env.CONNECTIONSTRING,
    poolMin: Number(process.env.DB_POOL_MIN || 0),
    poolMax: Number(process.env.DB_POOL_MAX || 10),
    poolIncrement: Number(process.env.DB_POOL_INCREMENT || 1),
    poolTimeout: Number(process.env.DB_POOL_TIMEOUT || 60),
    queueTimeout: Number(process.env.DB_QUEUE_TIMEOUT || 60000)
  },
  jwtSecretKey: process.env.JWT_SECRET
};