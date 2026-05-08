/**
 * 例题训练控制器
 *
 * 端点：
 *   GET  /subjects                       — 用户所有学习科目 + 知识点
 *   POST /generate                       — AI 生成练习题（专项/综合/项目挑战）
 *   POST /generate-atomic                — 针对单个原子知识点生成专项练习
 *   POST /grade                          — AI 批改单题答案
 *   GET  /history                        — 练习历史列表
 *   GET  /history/:id                    — 单次练习详情
 *   GET  /wrong-notes                    — 错题本
 *   PATCH /wrong-notes/:id/reviewed      — 标记已复习
 *   DELETE /wrong-notes/:id              — 删除错题
 *   GET  /ai-corrections                 — AI 纠错日志
 *   GET  /stats                          — 练习统计
 */
import * as aiService from "../services/aiService.js";
import * as generationQueue from "../services/generationQueueService.js";
import * as sessionRepo from "../models/sessionRepository.js";
import * as blueprintRepo from "../models/blueprintRepository.js";
import * as sourceRepo from "../models/blueprintSourceRepository.js";
import * as practiceRepo from "../models/practiceRepository.js";
import * as practiceQuestionRepo from "../models/practiceQuestionRepository.js";
import * as wrongNoteRepo from "../models/wrongNoteRepository.js";
import * as aiCorrectionRepo from "../models/aiCorrectionRepository.js";
import { cache } from "../config/redis.js";
import { success } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { ErrorCodes } from "../constants/errorCodes.js";
import { attachSessionDisplay } from "../utils/sessionDisplay.js";

const STATS_TTL = 300;
const WRONG_NOTES_TTL = 180;
const SUBJECTS_TTL = 120;

const invalidateUserCaches = async (userId) => {
  await Promise.all([
    cache.del(`practice:stats:${userId}`),
    cache.del(`practice:wrong-notes:${userId}`),
    cache.del(`practice:subjects:${userId}`),
  ]);
};

const toRecentPracticeActivity = (session) => ({
  id: session.id,
  kind: "practice_session",
  mode: session.mode,
  language: session.language,
  createdAt: session.lastAnsweredAt ?? session.createdAt,
  practiceSessionId: session.id,
  correctCount: session.correctCount ?? 0,
  answeredCount: session.answeredCount ?? 0,
  totalCount: session.totalCount ?? 0,
  title: Array.isArray(session.topics)
    ? session.topics.slice(0, 2).join(" · ")
    : "",
});

const toRecentWrongNoteRetryActivity = (item) => ({
  id: item.id,
  kind: "wrong_note_retry",
  mode: "wrong_notes",
  language: item.request?.problemSnapshot?.language ?? "错题集",
  createdAt: item.createdAt,
  practiceSessionId: item.practiceSessionId ?? null,
  correctCount: item.response?.isCorrect ? 1 : 0,
  answeredCount: 1,
  totalCount: 1,
  title:
    item.request?.problemSnapshot?.title ||
    item.request?.problemSnapshot?.description ||
    "错题重做",
});

/* ────────────── 工具 ────────────── */
function collectLeafNames(node, result) {
  if (!node) return;
  if (!node.children || node.children.length === 0) {
    if (node.name) result.push(node.name);
    return;
  }
  for (const child of node.children) collectLeafNames(child, result);
}

function findLeafById(node, targetId, path = []) {
  if (!node) return null;
  const next = [...path, node.name];
  if (node.id === targetId && (!node.children || node.children.length === 0)) {
    return { id: node.id, name: node.name, path: path.join(" → ") };
  }
  if (node.children) {
    for (const c of node.children) {
      const r = findLeafById(c, targetId, next);
      if (r) return r;
    }
  }
  return null;
}

/* ────────────── 端点 ────────────── */

export const getSubjects = asyncHandler(async (req, res) => {
  const userId = req.user.sub;

  const cached = await cache.get(`practice:subjects:${userId}`);
  if (cached) return res.json(success(cached));

  const sessions = await sessionRepo.findByUserId(userId);
  const subjects = [];
  for (const session of sessions) {
    const blueprint = await blueprintRepo.findBySessionId(session.id);
    const topics = [];
    if (blueprint?.tree) collectLeafNames(blueprint.tree, topics);
    const resolvedSession = attachSessionDisplay(
      session,
      blueprint?.metadata ?? null,
    );
    subjects.push({
      sessionId: resolvedSession.id,
      language: resolvedSession.language,
      title: resolvedSession.title,
      intent: resolvedSession.intent,
      displayTitle: resolvedSession.displayTitle,
      displaySubtitle: resolvedSession.displaySubtitle,
      progress: resolvedSession.progress,
      topics,
      blueprintTree: blueprint?.tree ?? null,
    });
  }

  await cache.set(`practice:subjects:${userId}`, subjects, SUBJECTS_TTL);
  res.json(success(subjects));
});

export const generate = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const { sessionIds, mode, topics, difficulty } = req.body;

  if (!mode || !sessionIds?.length) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: "缺少必要参数",
      status: 400,
    });
  }

  const firstSession = await sessionRepo.findById(sessionIds[0]);
  if (!firstSession) {
    throw new AppError({
      code: ErrorCodes.NOT_FOUND,
      message: "会话不存在",
      status: 404,
    });
  }
  const language = firstSession.language;

  let sourcesContent = "";
  for (const sid of sessionIds) {
    const srcRecord = await sourceRepo.findBySession(sid);
    if (srcRecord?.sources?.length) {
      sourcesContent +=
        srcRecord.sources
          .slice(0, 5)
          .map(
            (s) =>
              `- [${s.title || s.url}](${s.url})${s.snippet ? ": " + s.snippet : ""}`,
          )
          .join("\n") + "\n";
    }
  }

  let resolvedTopics = topics ?? [];
  if (resolvedTopics.length === 0) {
    for (const sid of sessionIds) {
      const bp = await blueprintRepo.findBySessionId(sid);
      if (bp?.tree) collectLeafNames(bp.tree, resolvedTopics);
    }
  }

  let allLanguages = [language];
  if (sessionIds.length > 1) {
    for (const sid of sessionIds.slice(1)) {
      const sess = await sessionRepo.findById(sid);
      if (sess && !allLanguages.includes(sess.language)) {
        allLanguages.push(sess.language);
      }
    }
  }

  const result = await aiService.generatePractice({
    language: allLanguages.join(" + "),
    mode,
    topics: resolvedTopics,
    difficulty: difficulty ?? 2,
    sourcesContent: sourcesContent || undefined,
  });

  const ps = await practiceRepo.createSession({
    userId,
    mode,
    language: allLanguages.join(" + "),
    topics: resolvedTopics,
    difficulty: difficulty ?? 0,
    problems: result.problems ?? [],
    sourceSessionId: sessionIds[0],
  });

  if (result.problems?.length) {
    await practiceQuestionRepo.upsertProblems(ps.id, result.problems);
  }

  await invalidateUserCaches(userId);

  res.json(success({ ...result, practiceSessionId: ps.id }, "练习题生成成功"));
});

/**
 * POST /api/practice/generate-atomic
 * Body: { sessionId, atomicNodeId }
 *
 * 直接针对单个原子（叶子）知识点生成 5 题左右；优先读 Redis 预生成结果。
 */
export const generateAtomic = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const { sessionId, atomicNodeId } = req.body;
  if (!sessionId || !atomicNodeId) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: "缺少 sessionId 或 atomicNodeId",
      status: 400,
    });
  }

  const session = await sessionRepo.findById(sessionId);
  if (!session || session.userId !== userId) {
    throw new AppError({
      code: ErrorCodes.NOT_FOUND,
      message: "会话不存在",
      status: 404,
    });
  }

  const blueprint = await blueprintRepo.findBySessionId(sessionId);
  if (!blueprint?.tree) {
    throw new AppError({
      code: ErrorCodes.NOT_FOUND,
      message: "蓝图不存在",
      status: 404,
    });
  }

  const leaf = findLeafById(blueprint.tree, atomicNodeId);
  if (!leaf) {
    throw new AppError({
      code: ErrorCodes.NOT_FOUND,
      message: "未找到该原子知识点",
      status: 404,
    });
  }

  // 1) Redis 预生成命中
  const cached = await cache.get(
    `atomic_practice:${sessionId}:${atomicNodeId}`,
  );
  if (cached?.problems?.length && cached.practiceSessionId) {
    return res.json(
      success(
        {
          problems: cached.problems,
          practiceSessionId: cached.practiceSessionId,
          atomicNodeId,
          atomicNodeName: leaf.name,
        },
        "命中预生成缓存",
      ),
    );
  }

  // 2) DB 已存在
  const existing = await practiceRepo.findByAtomicNode(sessionId, atomicNodeId);
  if (existing) {
    return res.json(
      success(
        {
          problems: existing.problems ?? [],
          practiceSessionId: existing.id,
          atomicNodeId,
          atomicNodeName: leaf.name,
        },
        "已存在的练习",
      ),
    );
  }

  // 3) 现场生成
  const ps = await generationQueue.ensureAtomicPractice({
    sessionId,
    userId,
    language: session.language,
    leaf,
  });

  if (!ps) {
    throw new AppError({
      code: ErrorCodes.INTERNAL_ERROR,
      message: "AI 出题失败，请稍后重试",
      status: 500,
    });
  }

  await invalidateUserCaches(userId);

  res.json(
    success({
      problems: ps.problems ?? [],
      practiceSessionId: ps.id,
      atomicNodeId,
      atomicNodeName: leaf.name,
    }),
  );
});

export const grade = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const {
    practiceSessionId,
    problemIndex,
    problemType,
    problemDescription,
    correctAnswer,
    userAnswer,
    language,
  } = req.body;

  if (userAnswer === undefined || userAnswer === null) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: "缺少用户答案",
      status: 400,
    });
  }

  const gradeResult = await aiService.gradePracticeAnswer({
    language: language ?? "",
    problemType: problemType ?? "choice",
    problemDescription: problemDescription ?? "",
    correctAnswer: correctAnswer ?? "",
    userAnswer: String(userAnswer),
  });

  let answerRecord = null;
  if (practiceSessionId) {
    answerRecord = await practiceRepo.saveAnswer({
      practiceSessionId,
      problemIndex: problemIndex ?? 0,
      userAnswer: String(userAnswer),
      isCorrect: gradeResult.isCorrect ?? false,
      aiFeedback: gradeResult,
      isWrongNote: !(gradeResult.isCorrect ?? false),
    });

    // AI 纠错文本日志（每次批改都记一条）
    await aiCorrectionRepo.create({
      userId,
      practiceSessionId,
      scope: "practice_grade",
      referenceId: String(problemIndex ?? 0),
      request: {
        problemType,
        problemDescription,
        correctAnswer,
        userAnswer,
        language,
      },
      response: gradeResult,
      text: gradeResult.feedback ?? "",
    });

    // 错题独立持久化
    if (!gradeResult.isCorrect) {
      const persistedQ = await practiceQuestionRepo.findByIndex(
        practiceSessionId,
        problemIndex ?? 0,
      );
      await wrongNoteRepo.create({
        userId,
        practiceSessionId,
        practiceAnswerId: answerRecord?.id,
        problemIndex: problemIndex ?? 0,
        problemSnapshot: persistedQ?.payload ?? {
          type: problemType,
          description: problemDescription,
          correctAnswer,
        },
        userAnswer: String(userAnswer),
        correctAnswer: gradeResult.correctAnswer ?? correctAnswer ?? null,
        aiCorrection: gradeResult.feedback ?? "",
        aiFeedback: gradeResult,
        tags: persistedQ?.tags ?? [],
      });
    }
  }

  await invalidateUserCaches(userId);

  res.json(success(gradeResult, "批改完成"));
});

export const getHistory = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const { mode } = req.query;
  const list = await practiceRepo.findSessionsByUser(userId, {
    mode: mode || undefined,
  });

  const enriched = [];
  for (const ps of list) {
    const answers = await practiceRepo.findAnswersBySession(ps.id);
    const total = ps.problems?.length ?? 0;
    const answered = answers.length;
    const correct = answers.filter((a) => a.isCorrect).length;
    enriched.push({
      ...ps,
      answeredCount: answered,
      correctCount: correct,
      totalCount: total,
      answers,
    });
  }

  res.json(success(enriched));
});

export const getRecentActivities = asyncHandler(async (req, res) => {
  const userId = req.user.sub;

  const [answeredSessions, retries] = await Promise.all([
    practiceRepo.findAnsweredSessionsByUser(userId, { limit: 24 }),
    aiCorrectionRepo.findByUser(userId, {
      scope: "wrong_note_retry",
      limit: 24,
    }),
  ]);

  const activities = [
    ...answeredSessions.map(toRecentPracticeActivity),
    ...retries.map(toRecentWrongNoteRetryActivity),
  ]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 8);

  res.json(success(activities));
});

export const getHistoryDetail = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const ps = await practiceRepo.findSessionById(req.params.id);
  if (!ps) {
    throw new AppError({
      code: ErrorCodes.NOT_FOUND,
      message: "练习记录不存在",
      status: 404,
    });
  }
  if (ps.userId !== userId) {
    throw new AppError({
      code: ErrorCodes.NOT_FOUND,
      message: "练习记录不存在",
      status: 404,
    });
  }
  const answers = await practiceRepo.findAnswersBySession(ps.id);
  res.json(success({ ...ps, answers }));
});

export const getWrongNotes = asyncHandler(async (req, res) => {
  const userId = req.user.sub;

  const cached = await cache.get(`practice:wrong-notes:${userId}`);
  if (cached) return res.json(success(cached));

  const notes = await wrongNoteRepo.findByUser(userId, { limit: 200 });
  const retries = await aiCorrectionRepo.findByReferences(
    userId,
    "wrong_note_retry",
    notes.map((note) => note.id),
  );

  const retryMap = retries.reduce((acc, item) => {
    const key = item.referenceId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const enriched = notes.map((note) => ({
    ...note,
    retryCount: retryMap[note.id]?.length ?? 0,
    retryHistory:
      retryMap[note.id]?.map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        request: item.request,
        response: item.response,
        text: item.text,
      })) ?? [],
  }));

  await cache.set(`practice:wrong-notes:${userId}`, enriched, WRONG_NOTES_TTL);
  res.json(success(enriched));
});

export const retryWrongNote = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const { userAnswer } = req.body;

  if (
    userAnswer === undefined ||
    userAnswer === null ||
    String(userAnswer).trim() === ""
  ) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: "缺少重新作答内容",
      status: 400,
    });
  }

  const note = await wrongNoteRepo.findById(req.params.id, userId);
  if (!note) {
    throw new AppError({
      code: ErrorCodes.NOT_FOUND,
      message: "错题不存在",
      status: 404,
    });
  }

  const snapshot = note.problemSnapshot ?? {};
  const practiceSession = note.practiceSessionId
    ? await practiceRepo.findSessionById(note.practiceSessionId)
    : null;
  const gradeResult = await aiService.gradePracticeAnswer({
    language:
      practiceSession?.language ?? snapshot.language ?? snapshot.subject ?? "",
    problemType: snapshot.type ?? "choice",
    problemDescription: snapshot.description ?? snapshot.title ?? "",
    correctAnswer:
      note.correctAnswer ??
      snapshot.correctAnswer ??
      snapshot.answer ??
      snapshot.solution ??
      "",
    userAnswer: String(userAnswer),
  });

  const correctionLog = await aiCorrectionRepo.create({
    userId,
    practiceSessionId: note.practiceSessionId,
    scope: "wrong_note_retry",
    referenceId: note.id,
    request: {
      wrongNoteId: note.id,
      userAnswer: String(userAnswer),
      problemSnapshot: snapshot,
    },
    response: gradeResult,
    text: gradeResult.feedback ?? "",
  });

  await invalidateUserCaches(userId);

  res.json(
    success(
      {
        noteId: note.id,
        retry: {
          id: correctionLog.id,
          createdAt: correctionLog.createdAt,
          request: correctionLog.request,
          response: correctionLog.response,
          text: correctionLog.text,
        },
        gradeResult,
      },
      "错题重新评估完成",
    ),
  );
});

export const markWrongNoteReviewed = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const note = await wrongNoteRepo.markReviewed(req.params.id, userId);
  await cache.del(`practice:wrong-notes:${userId}`);
  res.json(success(note));
});

export const removeWrongNote = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  await wrongNoteRepo.remove(req.params.id, userId);
  await cache.del(`practice:wrong-notes:${userId}`);
  res.json(success(null));
});

export const getAiCorrections = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const { scope, limit } = req.query;
  const list = await aiCorrectionRepo.findByUser(userId, {
    scope: scope || undefined,
    limit: limit ? Number(limit) : 50,
  });
  res.json(success(list));
});

export const getStatsData = asyncHandler(async (req, res) => {
  const userId = req.user.sub;

  const cached = await cache.get(`practice:stats:${userId}`);
  if (cached) return res.json(success(cached));

  const stats = await practiceRepo.getStats(userId);
  await cache.set(`practice:stats:${userId}`, stats, STATS_TTL);
  res.json(success(stats));
});
