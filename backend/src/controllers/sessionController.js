/**
 * 学习会话控制器
 *
 * HTTP 适配层：从 req 提参数、调用 service、用统一 response 返回。
 */
import * as sessionService from '../services/sessionService.js';
import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const create = asyncHandler(async (req, res) => {
  const result = await sessionService.createSession(req.user.sub, req.body);
  res.status(201).json(success(result, '会话创建成功'));
});

export const list = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const sessions = await sessionService.listSessions(req.user.sub, { status });
  res.json(success(sessions));
});

export const get = asyncHandler(async (req, res) => {
  const session = await sessionService.getSession(req.user.sub, req.params.id);
  res.json(success(session));
});

export const update = asyncHandler(async (req, res) => {
  const session = await sessionService.updateSession(
    req.user.sub,
    req.params.id,
    req.body,
  );
  res.json(success(session, '会话已更新'));
});

export const remove = asyncHandler(async (req, res) => {
  await sessionService.deleteSession(req.user.sub, req.params.id);
  res.json(success(null, '会话已删除'));
});

export const getProgress = asyncHandler(async (req, res) => {
  const data = await sessionService.getGenerationProgress(
    req.user.sub,
    req.params.id,
  );
  res.json(success(data));
});
