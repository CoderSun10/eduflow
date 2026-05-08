/**
 * JWT 签发与校验
 *
 * v0.1 使用 HS256 + 单密钥；生产环境应切换 RS256 + 公私钥对，
 * 仅需替换 sign / verify 内部参数，调用方接口保持不变。
 */
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const signAccessToken = (payload) =>
  jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });

export const signRefreshToken = (payload) =>
  jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.refreshExpiresIn });

export const verifyToken = (token) => jwt.verify(token, env.jwt.secret);
