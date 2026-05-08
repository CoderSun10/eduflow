/**
 * 练习数据访问层
 *
 * practice_sessions  — 每次生成一组题目
 * practice_answers   — 每道题的作答记录
 */
import { query } from "../config/database.js";

/* ── helpers ── */
const toSession = (r) =>
  r
    ? {
        id: r.id,
        userId: r.user_id,
        mode: r.mode,
        language: r.language,
        topics: r.topics,
        difficulty: r.difficulty,
        problems: r.problems,
        sourceSessionId: r.source_session_id,
        atomicNodeId: r.atomic_node_id,
        createdAt: r.created_at,
        answeredCount:
          r.answered_count === undefined ? undefined : Number(r.answered_count),
        correctCount:
          r.correct_count === undefined ? undefined : Number(r.correct_count),
        totalCount: r.problems ? r.problems.length : 0,
        lastAnsweredAt: r.last_answered_at,
      }
    : null;

const toAnswer = (r) =>
  r
    ? {
        id: r.id,
        practiceSessionId: r.practice_session_id,
        problemIndex: r.problem_index,
        userAnswer: r.user_answer,
        isCorrect: r.is_correct,
        aiFeedback: r.ai_feedback,
        isWrongNote: r.is_wrong_note,
        createdAt: r.created_at,
      }
    : null;

/* ── practice_sessions ── */

export const createSession = async ({
  userId,
  mode,
  language,
  topics,
  difficulty,
  problems,
  sourceSessionId,
  atomicNodeId,
}) => {
  const { rows } = await query(
    `INSERT INTO practice_sessions
       (user_id, mode, language, topics, difficulty, problems, source_session_id, atomic_node_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      userId,
      mode,
      language,
      JSON.stringify(topics),
      difficulty,
      JSON.stringify(problems),
      sourceSessionId ?? null,
      atomicNodeId ?? null,
    ],
  );
  return toSession(rows[0]);
};

export const findByAtomicNode = async (sourceSessionId, atomicNodeId) => {
  const { rows } = await query(
    `SELECT * FROM practice_sessions
     WHERE source_session_id = $1 AND atomic_node_id = $2
     ORDER BY created_at DESC LIMIT 1`,
    [sourceSessionId, atomicNodeId],
  );
  return toSession(rows[0]);
};

export const findSessionById = async (id) => {
  const { rows } = await query(
    "SELECT * FROM practice_sessions WHERE id = $1",
    [id],
  );
  return toSession(rows[0]);
};

export const findSessionsByUser = async (userId, { mode, limit = 50 } = {}) => {
  let sql = "SELECT * FROM practice_sessions WHERE user_id = $1";
  const params = [userId];
  if (mode) {
    sql += " AND mode = $2";
    params.push(mode);
  }
  sql += " ORDER BY created_at DESC";
  if (limit) {
    sql += ` LIMIT ${Number(limit)}`;
  }
  const { rows } = await query(sql, params);
  return rows.map(toSession);
};

export const findAnsweredSessionsByUser = async (
  userId,
  { mode, limit = 50 } = {},
) => {
  const params = [userId];
  let sql = `SELECT
      ps.*,
      COUNT(pa.id) AS answered_count,
      COUNT(pa.id) FILTER (WHERE pa.is_correct = true) AS correct_count,
      MAX(pa.created_at) AS last_answered_at
    FROM practice_sessions ps
    JOIN practice_answers pa ON pa.practice_session_id = ps.id
    WHERE ps.user_id = $1`;

  if (mode) {
    params.push(mode);
    sql += ` AND ps.mode = $${params.length}`;
  }

  sql += `
    GROUP BY ps.id
    ORDER BY MAX(pa.created_at) DESC, ps.created_at DESC`;

  if (limit) {
    sql += ` LIMIT ${Number(limit)}`;
  }

  const { rows } = await query(sql, params);
  return rows.map(toSession);
};

/* ── practice_answers ── */

export const saveAnswer = async ({
  practiceSessionId,
  problemIndex,
  userAnswer,
  isCorrect,
  aiFeedback,
  isWrongNote,
}) => {
  const { rows } = await query(
    `INSERT INTO practice_answers (practice_session_id, problem_index, user_answer, is_correct, ai_feedback, is_wrong_note)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      practiceSessionId,
      problemIndex,
      userAnswer,
      isCorrect,
      JSON.stringify(aiFeedback ?? {}),
      isWrongNote ?? false,
    ],
  );
  return toAnswer(rows[0]);
};

export const findAnswersBySession = async (practiceSessionId) => {
  const { rows } = await query(
    "SELECT * FROM practice_answers WHERE practice_session_id = $1 ORDER BY problem_index",
    [practiceSessionId],
  );
  return rows.map(toAnswer);
};

export const findWrongAnswers = async (userId, { limit = 50 } = {}) => {
  const { rows } = await query(
    `SELECT pa.*, ps.language, ps.mode
     FROM practice_answers pa
     JOIN practice_sessions ps ON ps.id = pa.practice_session_id
     WHERE ps.user_id = $1 AND pa.is_correct = false
     ORDER BY pa.created_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  return rows.map((r) => ({
    ...toAnswer(r),
    language: r.language,
    mode: r.mode,
  }));
};

export const getStats = async (userId) => {
  const { rows } = await query(
    `WITH answered_sessions AS (
       SELECT ps.id
       FROM practice_sessions ps
       WHERE ps.user_id = $1
         AND EXISTS (
           SELECT 1
           FROM practice_answers pa
           WHERE pa.practice_session_id = ps.id
         )
     ),
     answer_stats AS (
       SELECT
         COUNT(pa.id) AS total_answered,
         COUNT(pa.id) FILTER (WHERE pa.is_correct = true) AS total_correct,
         COUNT(pa.id) FILTER (WHERE pa.is_correct = false) AS total_wrong
       FROM practice_answers pa
       JOIN practice_sessions ps ON ps.id = pa.practice_session_id
       WHERE ps.user_id = $1
     ),
     wrong_note_retry_stats AS (
       SELECT COUNT(*) AS retry_count
       FROM ai_corrections
       WHERE user_id = $1
         AND scope = 'wrong_note_retry'
     )
     SELECT
       (SELECT COUNT(*) FROM answered_sessions) +
         COALESCE((SELECT retry_count FROM wrong_note_retry_stats), 0)
         AS total_sessions,
       COALESCE((SELECT total_answered FROM answer_stats), 0) AS total_answered,
       COALESCE((SELECT total_correct FROM answer_stats), 0) AS total_correct,
       COALESCE((SELECT total_wrong FROM answer_stats), 0) AS total_wrong`,
    [userId],
  );
  const r = rows[0];
  return {
    totalSessions: Number(r.total_sessions),
    totalAnswered: Number(r.total_answered),
    totalCorrect: Number(r.total_correct),
    totalWrong: Number(r.total_wrong),
    accuracy:
      Number(r.total_answered) > 0
        ? Math.round((Number(r.total_correct) / Number(r.total_answered)) * 100)
        : 0,
  };
};
