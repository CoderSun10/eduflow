/**
 * 学习会话请求体 schema
 */
import { z } from 'zod';

export const createSessionSchema = z.object({
  title: z
    .string()
    .min(1, '会话标题不能为空')
    .max(120, '会话标题不能超过 120 个字符'),
  language: z
    .string()
    .min(1, '编程语言不能为空')
    .max(32, '编程语言名称过长'),
  intent: z
    .string()
    .min(1, '学习意图不能为空')
    .max(2000, '学习意图不能超过 2000 个字符'),
});

export const updateSessionSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  status: z.enum(['active', 'paused', 'completed', 'archived']).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  lastNodeId: z.string().uuid().optional(),
});
