/**
 * 环境变量装载与校验
 *
 * 集中入口：所有读取 process.env 的代码都应从本文件导入 env 对象，
 * 而不是散落在业务代码各处。这样新增配置时只需要改一处，
 * 也方便日后接入更严格的校验（例如用 zod 做 schema）。
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 根据环境加载对应的 .env 文件
const envFile = `.env.${process.env.NODE_ENV || "development"}`;
dotenv.config({ path: join(__dirname, "../../", envFile) });

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toList = (value, fallback = []) =>
  value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : fallback;

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: toInt(process.env.PORT, 4000),

  corsOrigins: toList(process.env.CORS_ORIGINS, [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]),

  jwt: Object.freeze({
    secret: process.env.JWT_SECRET ?? "dev_only_secret_do_not_use_in_prod",
    expiresIn: process.env.JWT_EXPIRES_IN ?? "24h",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
  }),

  bcrypt: Object.freeze({
    saltRounds: toInt(process.env.BCRYPT_SALT_ROUNDS, 12),
  }),

  rateLimit: Object.freeze({
    windowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    max: toInt(process.env.RATE_LIMIT_MAX, 60),
  }),

  database: Object.freeze({
    url: process.env.DATABASE_URL ?? "",
  }),

  deepseek: Object.freeze({
    apiKey: process.env.DEEPSEEK_API_KEY ?? "",
    baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
  }),

  redis: Object.freeze({
    url: process.env.REDIS_URL ?? "",
    host: process.env.REDIS_HOST ?? "127.0.0.1",
    port: toInt(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD ?? "",
    db: toInt(process.env.REDIS_DB, 0),
  }),

  tavily: Object.freeze({
    apiKey: process.env.TAVILY_API_KEY ?? "",
  }),

  email: Object.freeze({
    host: process.env.EMAIL_HOST ?? "",
    port: toInt(process.env.EMAIL_PORT, 465),
    secure: process.env.EMAIL_SECURE !== "false",
    user: process.env.EMAIL_USER ?? "",
    pass: process.env.EMAIL_PASS ?? "",
  }),

  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",

  aliyunNls: Object.freeze({
    accessKeyId: process.env.ALIYUN_AK_ID ?? "",
    accessKeySecret: process.env.ALIYUN_AK_SECRET ?? "",
    appKey: process.env.ALIYUN_NLS_APPKEY ?? "",
  }),
});

export const isProduction = env.nodeEnv === "production";
export const isDevelopment = env.nodeEnv === "development";
export const isTest = env.nodeEnv === "test";
