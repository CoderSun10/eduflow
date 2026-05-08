/**
 * PostgreSQL 数据库连接池
 *
 * 使用 node-postgres (pg) 的 Pool，全应用共享一个连接池。
 * 连接参数从 env.js 导入。
 */
import pg from "pg";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

const { Pool } = pg;

// 解析连接字符串
const parseDatabaseUrl = (url) => {
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) {
    throw new Error(`Invalid database URL format: ${url}`);
  }
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: parseInt(match[4], 10),
    database: match[5],
  };
};

const dbConfig = parseDatabaseUrl(env.database.url);

export const pool = new Pool({
  user: dbConfig.user,
  password: dbConfig.password,
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  logger.error("PostgreSQL 连接池异常", { err: err.message });
});

/**
 * 便捷查询函数
 * @param {string} text - SQL 语句
 * @param {any[]} params - 参数
 * @returns {Promise<pg.QueryResult>}
 */
export const query = (text, params) => pool.query(text, params);

/**
 * 获取单个客户端（用于事务）
 * @returns {Promise<pg.PoolClient>}
 */
export const getClient = () => pool.connect();
