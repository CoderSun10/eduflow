/**
 * 认证相关请求体 schema
 *
 * 集中放在 validators 层，方便单测与复用，避免在 controller 里散落字符串校验。
 */
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('邮箱格式不正确').max(120),
  username: z
    .string()
    .min(2, '用户名至少 2 个字符')
    .max(32, '用户名不能超过 32 个字符'),
  password: z
    .string()
    .min(8, '密码至少 8 位')
    .max(64, '密码不能超过 64 位'),
  learningFocus: z.string().max(64).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '密码不能为空'),
});
