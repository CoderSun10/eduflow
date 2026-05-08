/**
 * 错题集 Repository
 *
 * 当 practice_answers.is_correct = false 时，自动写入 wrong_notes 一条详细记录，
 * 包含题目快照（避免后续题目修改丢失上下文）、AI 纠错文本、用户答案、正确答案。
 */
import { query } from "../config/database.js";

const toRow = (r) =>
  r
    ? {
        id: r.id,
        userId: r.user_id,
        practiceSessionId: r.practice_session_id,
        practiceAnswerId: r.practice_answer_id,
        problemIndex: r.problem_index,
        problemSnapshot: r.problem_snapshot,
        userAnswer: r.user_answer,
        correctAnswer: r.correct_answer,
        aiCorrection: r.ai_correction,
        aiFeedback: r.ai_feedback,
        tags: r.tags,
        reviewed: r.reviewed,
        reviewedAt: r.reviewed_at,
        createdAt: r.created_at,
      }
    : null;

export const create = async ({
  userId,
  practiceSessionId,
  practiceAnswerId,
  problemIndex,
  problemSnapshot,
  userAnswer,
  correctAnswer,
  aiCorrection,
  aiFeedback,
  tags,
}) => {
  const { rows } = await query(
    `INSERT INTO wrong_notes
      (user_id, practice_session_id, practice_answer_id, problem_index,
       problem_snapshot, user_answer, correct_answer, ai_correction,
       ai_feedback, tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      userId,
      practiceSessionId,
      practiceAnswerId ?? null,
      problemIndex,
      JSON.stringify(problemSnapshot ?? {}),
      userAnswer ?? null,
      correctAnswer ?? null,
      aiCorrection ?? null,
      JSON.stringify(aiFeedback ?? {}),
      JSON.stringify(tags ?? []),
    ],
  );
  return toRow(rows[0]);
};

export const findByUser = async (
  userId,
  { limit = 100, onlyUnreviewed = false } = {},
) => {
  const params = [userId];
  let sql = `SELECT * FROM wrong_notes WHERE user_id = $1`;
  if (onlyUnreviewed) sql += ` AND reviewed = false`;
  sql += ` ORDER BY created_at DESC LIMIT ${Number(limit)}`;
  const { rows } = await query(sql, params);
  return rows.map(toRow);
};

export const findById = async (id, userId) => {
  const { rows } = await query(
    `SELECT * FROM wrong_notes WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  return toRow(rows[0]);
};

export const markReviewed = async (id, userId) => {
  const { rows } = await query(
    `UPDATE wrong_notes SET reviewed = true, reviewed_at = NOW()
     WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, userId],
  );
  return toRow(rows[0]);
};

export const remove = async (id, userId) => {
  await query(`DELETE FROM wrong_notes WHERE id = $1 AND user_id = $2`, [
    id,
    userId,
  ]);
};
