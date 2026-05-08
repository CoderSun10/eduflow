/**
 * 学习会话业务逻辑（Service 层）
 *
 * 编排 session + blueprint repository，处理会话创建 / 查询 / 更新 / 删除。
 * 创建会话时通过 DeepSeek AI 生成个性化知识蓝图（树状思维导图）。
 */
import * as sessionRepo from "../models/sessionRepository.js";
import * as blueprintRepo from "../models/blueprintRepository.js";
import * as blueprintSourceRepo from "../models/blueprintSourceRepository.js";
import * as progressRepo from "../models/generationProgressRepository.js";
import * as aiService from "./aiService.js";
import * as generationQueue from "./generationQueueService.js";
import { cache } from "../config/redis.js";
import { AppError } from "../utils/AppError.js";
import { ErrorCodes } from "../constants/errorCodes.js";
import { logger } from "../utils/logger.js";
import { attachSessionDisplay } from "../utils/sessionDisplay.js";

const assertOwnership = (session, userId) => {
  if (session.userId !== userId) {
    throw new AppError({
      code: ErrorCodes.RESOURCE_NOT_FOUND,
      message: "会话不存在",
      status: 404,
    });
  }
};

const withDisplayFields = async (session) => {
  if (!session) return session;
  const blueprint = await blueprintRepo.findBySessionId(session.id);
  return attachSessionDisplay(session, blueprint?.metadata ?? null);
};

/**
 * 异步执行蓝图生成 + 预生成。失败时把进度标 failed，但不删 session（前端可重试）。
 */
const runBlueprintPipeline = async ({ session, userId }) => {
  const { id: sessionId, language, intent } = session;
  try {
    // AI 调用前先确认会话仍然存在（用户可能已删除）
    const stillExists = await sessionRepo.findById(sessionId);
    if (!stillExists) {
      logger.warn("蓝图流水线跳过：会话已不存在", { sessionId });
      return;
    }

    const result = await aiService.generateBlueprint(language, intent);

    // AI 调用耗时较长，再次确认会话存在
    const stillExists2 = await sessionRepo.findById(sessionId);
    if (!stillExists2) {
      logger.warn("蓝图流水线跳过：AI 生成期间会话已被删除", { sessionId });
      return;
    }

    const blueprint = await blueprintRepo.create({
      sessionId,
      tree: result.tree,
      metadata: result.metadata,
    });
    if (result.sources?.length) {
      await blueprintSourceRepo.upsert(sessionId, result.sources);
    }
    await cache.set(`blueprint:${sessionId}`, blueprint, 7200);

    await progressRepo.upsert({
      sessionId,
      scope: "blueprint",
      referenceId: sessionId,
      status: "done",
      detail: { metadata: result.metadata },
    });

    // 后续：节点内容预生成 + 原子练习预生成
    await generationQueue.kickoffPreGeneration({
      session,
      blueprintTree: blueprint.tree,
      userId,
    });
  } catch (err) {
    logger.error("蓝图生成流水线失败", {
      err: err.message,
      sessionId,
    });
    try {
      await progressRepo.upsert({
        sessionId,
        scope: "blueprint",
        referenceId: sessionId,
        status: "failed",
        error: err.message,
      });
    } catch (progressErr) {
      logger.warn("蓝图失败状态记录失败（会话可能已删除）", {
        sessionId,
        err: progressErr.message,
      });
    }
  }
};

export const createSession = async (userId, { title, language, intent }) => {
  logger.info("创建会话", { userId, title, language, intent });
  const session = await sessionRepo.create({ userId, title, language, intent });

  await progressRepo.upsert({
    sessionId: session.id,
    scope: "blueprint",
    referenceId: session.id,
    status: "running",
    detail: { stage: "searching" },
  });

  // 异步启动整条流水线，立即返回 session 让前端可以轮询进度
  runBlueprintPipeline({ session, userId }).catch((err) =>
    logger.error("流水线异常", { err: err.message }),
  );

  return { session: attachSessionDisplay(session), blueprint: null };
};

/**
 * 获取某个会话的生成进度（蓝图 + 节点 + 原子练习）
 */
export const getGenerationProgress = async (userId, sessionId) => {
  const session = await sessionRepo.findById(sessionId);
  if (!session || session.userId !== userId) {
    throw new AppError({
      code: ErrorCodes.RESOURCE_NOT_FOUND,
      message: "会话不存在",
      status: 404,
    });
  }
  const items = await progressRepo.findBySession(sessionId);
  const summary = {
    blueprint: { done: 0, total: 0 },
    node_content: { done: 0, total: 0, running: 0 },
    atomic_practice: { done: 0, total: 0, running: 0 },
  };
  for (const it of items) {
    const s = summary[it.scope];
    if (!s) continue;
    s.total++;
    if (it.status === "done") s.done++;
    if (it.status === "running") s.running = (s.running ?? 0) + 1;
  }
  return { items, summary };
};

export const listSessions = async (userId, filters = {}) => {
  const sessions = await sessionRepo.findByUserId(userId, filters);
  return Promise.all(sessions.map(withDisplayFields));
};

export const getSession = async (userId, sessionId) => {
  const session = await sessionRepo.findById(sessionId);
  if (!session) {
    throw new AppError({
      code: ErrorCodes.RESOURCE_NOT_FOUND,
      message: "会话不存在",
      status: 404,
    });
  }
  assertOwnership(session, userId);
  return withDisplayFields(session);
};

export const updateSession = async (userId, sessionId, patch) => {
  const session = await sessionRepo.findById(sessionId);
  if (!session) {
    throw new AppError({
      code: ErrorCodes.RESOURCE_NOT_FOUND,
      message: "会话不存在",
      status: 404,
    });
  }
  assertOwnership(session, userId);
  const updated = await sessionRepo.update(sessionId, patch);
  return withDisplayFields(updated);
};

export const deleteSession = async (userId, sessionId) => {
  const session = await sessionRepo.findById(sessionId);
  if (!session) {
    throw new AppError({
      code: ErrorCodes.RESOURCE_NOT_FOUND,
      message: "会话不存在",
      status: 404,
    });
  }
  assertOwnership(session, userId);

  // 删除 DB 数据（级联删除会清理 node_contents, chat_histories, code_reviews, blueprint_sources）
  await blueprintRepo.remove(sessionId);
  await sessionRepo.remove(sessionId);

  // 清理 Redis 缓存
  await cache.del(`blueprint:${sessionId}`);
  await cache.delPattern(`node_content:${sessionId}:*`);
};
