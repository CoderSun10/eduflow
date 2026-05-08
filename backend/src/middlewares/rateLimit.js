/**
 * 速率限制中间件
 *
 * SRS §4.2：单用户每分钟最多 60 次普通请求，10 次 AI 请求。
 * 这里提供两个预设：默认 generalLimiter，AI 接口使用 aiLimiter。
 */
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { fail } from '../utils/response.js';

const handler = (_req, res) =>
  res.status(429).json(fail(ErrorCodes.RATE_LIMITED, '请求过于频繁，请稍后再试'));

export const generalLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

export const aiLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});
