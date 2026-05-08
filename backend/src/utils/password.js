/**
 * 密码哈希工具
 *
 * SRS §4.2：用户密码必须以 Bcrypt 加密存储，cost factor >= 12。
 */
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

export const hashPassword = (plain) => bcrypt.hash(plain, env.bcrypt.saltRounds);

export const comparePassword = (plain, hashed) => bcrypt.compare(plain, hashed);
