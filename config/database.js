const rawConnectionString = process.env.CONNECTIONSTRING || '';
const connectionString = rawConnectionString.replace(/^https?:\/\//i, '').trim();

module.exports = {
  dbPool: {
    user: process.env.USERDB,
    password: process.env.PASSWORD,
    connectionString: connectionString,
    poolMin: Number(process.env.DB_POOL_MIN || 0),
    poolMax: Number(process.env.DB_POOL_MAX || 10),
    poolIncrement: Number(process.env.DB_POOL_INCREMENT || 1),
    poolTimeout: Number(process.env.DB_POOL_TIMEOUT || 60),
    queueTimeout: Number(process.env.DB_QUEUE_TIMEOUT || 60000)
  },
  jwtSecretKey: process.env.JWT_SECRET
};