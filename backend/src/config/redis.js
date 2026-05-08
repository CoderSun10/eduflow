/**
 * Redis 客户端配置
 *
 * 使用 ioredis 连接 Redis，提供缓存能力。
 * 连接参数从 env.js 导入。
 */
import Redis from "ioredis";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

const redisConfig = {
  host: env.redis.host,
  port: env.redis.port,
  db: env.redis.db,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 3000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  lazyConnect: true,
};

if (env.redis.password) {
  redisConfig.password = env.redis.password;
}

export const redis = env.redis.url
  ? new Redis(env.redis.url, {
      retryStrategy(times) {
        const delay = Math.min(times * 200, 3000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    })
  : new Redis(redisConfig);

redis.on("connect", () => {
  logger.info("Redis 连接成功");
});

redis.on("error", (err) => {
  logger.error("Redis 连接异常", { err: err.message });
});

/**
 * 连接 Redis（应用启动时调用）
 */
export const connectRedis = async () => {
  try {
    await redis.connect();
  } catch (err) {
    logger.error("Redis 连接失败，缓存功能将不可用", { err: err.message });
  }
};

/**
 * 缓存工具函数
 */
export const cache = {
  /**
   * 获取缓存
   * @param {string} key
   * @returns {Promise<any|null>}
   */
  async get(key) {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  /**
   * 设置缓存
   * @param {string} key
   * @param {any} value
   * @param {number} ttl - 过期时间（秒），默认 3600
   */
  async set(key, value, ttl = 3600) {
    try {
      await redis.set(key, JSON.stringify(value), "EX", ttl);
    } catch {
      // 缓存写入失败不影响业务
    }
  },

  /**
   * 删除缓存
   * @param {string} key
   */
  async del(key) {
    try {
      await redis.del(key);
    } catch {
      // ignore
    }
  },

  /**
   * 批量删除匹配的键
   * @param {string} pattern
   */
  async delPattern(pattern) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch {
      // ignore
    }
  },

  /** 在已存在的 key 上设置/刷新 TTL */
  async expire(key, ttl) {
    try {
      await redis.expire(key, ttl);
    } catch {
      // ignore
    }
  },

  /** 原子加 1（用于计数 / 限流） */
  async incr(key, ttl) {
    try {
      const v = await redis.incr(key);
      if (ttl && v === 1) await redis.expire(key, ttl);
      return v;
    } catch {
      return null;
    }
  },
};

/**
 * 简易后台任务队列（基于 Redis list）。
 * 单进程消费即可——专项预生成任务可丢失重做，没必要引入 BullMQ。
 */
export const taskQueue = {
  KEY: "eduflow:bg-tasks",

  async push(task) {
    try {
      await redis.rpush(this.KEY, JSON.stringify(task));
    } catch (err) {
      logger.error("任务入队失败", { err: err.message });
    }
  },

  async pop(timeoutSec = 5) {
    try {
      const result = await redis.blpop(this.KEY, timeoutSec);
      if (!result) return null;
      const [, raw] = result;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
};
