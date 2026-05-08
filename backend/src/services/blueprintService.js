/**
 * 知识蓝图业务逻辑（Service 层）
 *
 * 提供蓝图查询、节点状态更新、进度计算等能力。
 * 蓝图的创建由 sessionService.createSession 统一调度，本层不单独暴露 create。
 */
import * as blueprintRepo from "../models/blueprintRepository.js";
import * as sessionRepo from "../models/sessionRepository.js";
import * as blueprintSourceRepo from "../models/blueprintSourceRepository.js";
import { cache } from "../config/redis.js";
import { AppError } from "../utils/AppError.js";
import { ErrorCodes } from "../constants/errorCodes.js";

export const getBlueprint = async (userId, sessionId) => {
  // 校验会话归属
  const session = await sessionRepo.findById(sessionId);
  if (!session || session.userId !== userId) {
    throw new AppError({
      code: ErrorCodes.RESOURCE_NOT_FOUND,
      message: "会话不存在",
      status: 404,
    });
  }

  // 先查 Redis 缓存
  const cached = await cache.get(`blueprint:${sessionId}`);
  if (cached) return cached;

  const blueprint = await blueprintRepo.findBySessionId(sessionId);
  if (!blueprint) {
    throw new AppError({
      code: ErrorCodes.RESOURCE_NOT_FOUND,
      message: "蓝图不存在",
      status: 404,
    });
  }

  // 写入缓存
  await cache.set(`blueprint:${sessionId}`, blueprint, 7200);

  return blueprint;
};

export const getBlueprintSources = async (userId, sessionId) => {
  const session = await sessionRepo.findById(sessionId);
  if (!session || session.userId !== userId) {
    throw new AppError({
      code: ErrorCodes.RESOURCE_NOT_FOUND,
      message: "会话不存在",
      status: 404,
    });
  }

  return blueprintSourceRepo.findBySession(sessionId);
};

export const advanceNode = async (userId, sessionId, nodeId, newStatus) => {
  const session = await sessionRepo.findById(sessionId);
  if (!session || session.userId !== userId) {
    throw new AppError({
      code: ErrorCodes.RESOURCE_NOT_FOUND,
      message: "会话不存在",
      status: 404,
    });
  }

  const updated = await blueprintRepo.updateNodeStatus(
    sessionId,
    nodeId,
    newStatus,
  );
  if (!updated) {
    throw new AppError({
      code: ErrorCodes.RESOURCE_NOT_FOUND,
      message: "知识节点不存在",
      status: 404,
    });
  }

  // 计算进度（基于树结构中的叶子节点）
  const progress = blueprintRepo.calcProgress(updated.tree);
  await sessionRepo.update(sessionId, {
    progress,
    lastNodeId: nodeId,
    status: progress >= 100 ? "completed" : "active",
  });

  // 更新缓存
  await cache.set(`blueprint:${sessionId}`, updated, 7200);

  return { blueprint: updated, progress };
};
