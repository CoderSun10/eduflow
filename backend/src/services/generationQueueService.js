/**
 * AI 生成后台队列
 *
 * 蓝图生成完毕后，立刻并发预生成「前 N 个节点的学习内容」+「前 N 个原子知识点的专项练习」，
 * 让用户首次点开内容时无需等待；剩余节点放入后台慢慢生成。
 *
 * 注意：单进程、内存调度；进程重启会丢任务，但任务幂等，下次访问会触发懒加载补回。
 */
import * as aiService from "./aiService.js";
import * as nodeContentRepo from "../models/nodeContentRepository.js";
import * as practiceRepo from "../models/practiceRepository.js";
import * as practiceQuestionRepo from "../models/practiceQuestionRepository.js";
import * as progressRepo from "../models/generationProgressRepository.js";
import * as sessionRepo from "../models/sessionRepository.js";
import { cache } from "../config/redis.js";
import { logger } from "../utils/logger.js";

/** 检查会话是否仍然存在，不存在则跳过后续操作 */
const sessionExists = async (sessionId) => {
  const s = await sessionRepo.findById(sessionId);
  return !!s;
};

const PRELOAD_NODE_COUNT = 3;
const PRELOAD_PRACTICE_COUNT = 3;
const BG_CONCURRENCY = 2;
const BG_INTER_TASK_DELAY_MS = 1500;

/** 收集树中所有叶子节点（带父级路径） */
const collectLeaves = (root) => {
  const out = [];
  const walk = (node, path) => {
    if (!node) return;
    const next = [...path, node.name];
    const children = node.children ?? [];
    if (children.length === 0) {
      out.push({
        id: node.id,
        name: node.name,
        path: next.slice(0, -1).join(" → "),
      });
      return;
    }
    children.forEach((c) => walk(c, next));
  };
  walk(root, []);
  return out;
};

/** 单个节点学习内容生成 + 持久化 + Redis 缓存 + 进度记录 */
const generateAndCacheNodeContent = async ({
  sessionId,
  language,
  intent,
  leaf,
}) => {
  // 会话已被删除则跳过
  if (!(await sessionExists(sessionId))) {
    logger.warn("节点内容生成跳过：会话已不存在", {
      sessionId,
      nodeId: leaf.id,
    });
    return null;
  }

  // 已生成则跳过
  const existing = await nodeContentRepo.findBySessionAndNode(
    sessionId,
    leaf.id,
  );
  if (existing) {
    await progressRepo.upsert({
      sessionId,
      scope: "node_content",
      referenceId: leaf.id,
      status: "done",
      detail: { name: leaf.name, cached: true },
    });
    return existing;
  }

  await progressRepo.upsert({
    sessionId,
    scope: "node_content",
    referenceId: leaf.id,
    status: "running",
    detail: { name: leaf.name },
  });

  try {
    const content = await aiService.generateNodeContent(
      language,
      leaf.name,
      leaf.path,
      intent ?? "",
    );
    const saved = await nodeContentRepo.upsert(sessionId, leaf.id, content);
    await cache.set(
      `node_content:${sessionId}:${leaf.id}`,
      saved.content,
      3600,
    );
    await progressRepo.upsert({
      sessionId,
      scope: "node_content",
      referenceId: leaf.id,
      status: "done",
      detail: { name: leaf.name },
    });
    return saved;
  } catch (err) {
    logger.error("节点内容预生成失败", {
      err: err.message,
      sessionId,
      nodeId: leaf.id,
    });
    await progressRepo.upsert({
      sessionId,
      scope: "node_content",
      referenceId: leaf.id,
      status: "failed",
      detail: { name: leaf.name },
      error: err.message,
    });
    return null;
  }
};

/** 单个原子知识点的专项练习生成 + 持久化 + 进度记录 */
const generateAndCacheAtomicPractice = async ({
  sessionId,
  userId,
  language,
  leaf,
}) => {
  // 会话已被删除则跳过
  if (!(await sessionExists(sessionId))) {
    logger.warn("原子练习生成跳过：会话已不存在", {
      sessionId,
      nodeId: leaf.id,
    });
    return null;
  }

  // 已生成则跳过
  const existing = await practiceRepo.findByAtomicNode(sessionId, leaf.id);
  if (existing) {
    await progressRepo.upsert({
      sessionId,
      scope: "atomic_practice",
      referenceId: leaf.id,
      status: "done",
      detail: { name: leaf.name, cached: true },
    });
    return existing;
  }

  await progressRepo.upsert({
    sessionId,
    scope: "atomic_practice",
    referenceId: leaf.id,
    status: "running",
    detail: { name: leaf.name },
  });

  try {
    const result = await aiService.generatePractice({
      language,
      mode: "focused",
      topics: [leaf.name],
      difficulty: 0,
    });
    const ps = await practiceRepo.createSession({
      userId,
      mode: "focused",
      language,
      topics: [leaf.name],
      difficulty: 0,
      problems: result.problems ?? [],
      sourceSessionId: sessionId,
      atomicNodeId: leaf.id,
    });
    if (result.problems?.length) {
      await practiceQuestionRepo.upsertProblems(ps.id, result.problems);
    }
    await cache.set(
      `atomic_practice:${sessionId}:${leaf.id}`,
      { practiceSessionId: ps.id, problems: result.problems ?? [] },
      3600 * 6,
    );
    await progressRepo.upsert({
      sessionId,
      scope: "atomic_practice",
      referenceId: leaf.id,
      status: "done",
      detail: { name: leaf.name, count: result.problems?.length ?? 0 },
    });
    return ps;
  } catch (err) {
    logger.error("原子练习预生成失败", {
      err: err.message,
      sessionId,
      nodeId: leaf.id,
    });
    await progressRepo.upsert({
      sessionId,
      scope: "atomic_practice",
      referenceId: leaf.id,
      status: "failed",
      detail: { name: leaf.name },
      error: err.message,
    });
    return null;
  }
};

/**
 * 串行后台执行（带速率控制），单次失败不阻断后续任务。
 */
const runQueue = async (tasks) => {
  // 简易并发池
  let idx = 0;
  const workers = Array.from({ length: BG_CONCURRENCY }, async () => {
    while (idx < tasks.length) {
      const myIdx = idx++;
      try {
        await tasks[myIdx]();
      } catch (err) {
        logger.error("后台任务异常", { err: err.message });
      }
      if (BG_INTER_TASK_DELAY_MS) {
        await new Promise((r) => setTimeout(r, BG_INTER_TASK_DELAY_MS));
      }
    }
  });
  await Promise.all(workers);
};

/**
 * 蓝图生成完毕后调用：
 *   1. 先把所有任务在 generation_progress 中标 pending（前端可立刻看到总数）
 *   2. 立即（同步等待）预生成前 N 个节点内容 + N 个原子练习
 *   3. 异步（不阻塞 HTTP 响应）后台慢生成剩余项
 */
export const kickoffPreGeneration = async ({
  session,
  blueprintTree,
  userId,
}) => {
  const { id: sessionId, language, intent } = session;

  // 会话已被删除则跳过全部预生成
  if (!(await sessionExists(sessionId))) {
    logger.warn("预生成跳过：会话已不存在", { sessionId });
    return { totalLeaves: 0 };
  }

  const leaves = collectLeaves(blueprintTree);
  if (leaves.length === 0) return { totalLeaves: 0 };

  // 标记总览
  await Promise.all([
    progressRepo.upsert({
      sessionId,
      scope: "blueprint",
      referenceId: sessionId,
      status: "done",
      detail: { totalLeaves: leaves.length },
    }),
    ...leaves.flatMap((leaf) => [
      progressRepo.upsert({
        sessionId,
        scope: "node_content",
        referenceId: leaf.id,
        status: "pending",
        detail: { name: leaf.name },
      }),
      progressRepo.upsert({
        sessionId,
        scope: "atomic_practice",
        referenceId: leaf.id,
        status: "pending",
        detail: { name: leaf.name },
      }),
    ]),
  ]);

  const preNodes = leaves.slice(0, PRELOAD_NODE_COUNT);
  const prePractice = leaves.slice(0, PRELOAD_PRACTICE_COUNT);
  const restNodes = leaves.slice(PRELOAD_NODE_COUNT);
  const restPractice = leaves.slice(PRELOAD_PRACTICE_COUNT);

  // ── 立即预生成（与会话创建同步等待）──
  const preTasks = [
    ...preNodes.map(
      (leaf) => () =>
        generateAndCacheNodeContent({ sessionId, language, intent, leaf }),
    ),
    ...prePractice.map(
      (leaf) => () =>
        generateAndCacheAtomicPractice({ sessionId, userId, language, leaf }),
    ),
  ];

  // 同步等前 N 个节点内容（保证用户进入 workbench 即可读首篇）；练习异步即可
  await Promise.allSettled(
    preNodes.map((leaf) =>
      generateAndCacheNodeContent({ sessionId, language, intent, leaf }),
    ),
  );

  // 前几个原子练习异步开始（不阻塞 HTTP 响应）
  Promise.allSettled(
    prePractice.map((leaf) =>
      generateAndCacheAtomicPractice({ sessionId, userId, language, leaf }),
    ),
  ).catch(() => {});

  // ── 后台慢生成 ──
  const bgTasks = [
    ...restNodes.map(
      (leaf) => () =>
        generateAndCacheNodeContent({ sessionId, language, intent, leaf }),
    ),
    ...restPractice.map(
      (leaf) => () =>
        generateAndCacheAtomicPractice({ sessionId, userId, language, leaf }),
    ),
  ];
  if (bgTasks.length > 0) {
    runQueue(bgTasks).catch((err) =>
      logger.error("后台队列失败", { err: err.message }),
    );
  }

  return {
    totalLeaves: leaves.length,
    preloaded: preTasks.length,
    background: bgTasks.length,
  };
};

/**
 * 单个原子节点的练习生成（懒加载场景：用户点击未预生成的节点）
 */
export const ensureAtomicPractice = async ({
  sessionId,
  userId,
  language,
  leaf,
}) => {
  return generateAndCacheAtomicPractice({ sessionId, userId, language, leaf });
};

/**
 * 单个节点内容生成（懒加载）
 */
export const ensureNodeContent = async ({
  sessionId,
  language,
  intent,
  leaf,
}) => {
  return generateAndCacheNodeContent({ sessionId, language, intent, leaf });
};
