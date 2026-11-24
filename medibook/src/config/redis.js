require('dotenv').config();
const IORedis = require('ioredis');
const redis_host = process.env.REDIS_HOST || '127.0.0.1';
const redis_port = Number(process.env.REDIS_PORT) || 6379;

const bull_connection = {host: redis_host, port: redis_port};

const redis = new IORedis({
  host: redis_host,
  port: redis_port,
  max_retry_per_request: 2,
  retry_strategy: (attempt) => Math.min(attempt * 200, 2000)
});

redis.on('error', (err) => console.error('redis', err.message));

module.exports = {redis, bull_connection};
