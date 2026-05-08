/**
 * 服务进程入口
 *
 * 仅做"启动 / 优雅关闭"，业务装配在 app.js。
 */
import app from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { connectRedis, redis } from "./config/redis.js";
import { pool } from "./config/database.js";

// 启动 Redis 连接
connectRedis();

// 检查 PostgreSQL 数据库连接
const checkDatabaseConnection = async () => {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    logger.info("PostgreSQL 数据库连接成功");
  } catch (err) {
    logger.error("PostgreSQL 数据库连接失败", { err: err.message });
  }
};

const server = app.listen(env.port, async () => {
  logger.info("EduFlow 后端已启动", {
    port: env.port,
    env: env.nodeEnv,
  });

  // 检查数据库连接
  await checkDatabaseConnection();
});

const shutdown = (signal) => {
  logger.info(`收到 ${signal}，开始优雅关闭`);
  redis.disconnect();
  server.close((err) => {
    if (err) {
      logger.error("关闭过程中发生错误", { err: err.message });
      process.exit(1);
    }
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  logger.error("未处理的 Promise rejection", { reason: String(reason) });
});

process.on("uncaughtException", (err) => {
  logger.error("未捕获异常", { err: err.message, stack: err.stack });
  shutdown("uncaughtException");
});
