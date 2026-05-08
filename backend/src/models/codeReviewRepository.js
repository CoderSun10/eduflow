/**
 * 代码评价历史数据访问层（Repository）
 *
 * 持久化存储代码评价结果，供历史查看和学习报告使用。
 */
import { query } from '../config/database.js';

const toReview = (row) =>
  row
    ? {
        id: row.id,
        sessionId: row.session_id,
        nodeId: row.node_id,
        code: row.code,
        exerciseTitle: row.exercise_title,
        review: row.review,
        createdAt: row.created_at,
      }
    : null;

export const create = async ({ sessionId, nodeId, code, exerciseTitle, review }) => {
  const { rows } = await query(
    `INSERT INTO code_reviews (session_id, node_id, code, exercise_title, review)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [sessionId, nodeId ?? null, code, exerciseTitle ?? '', JSON.stringify(review)],
  );
  return toReview(rows[0]);
};

export const findBySession = async (sessionId) => {
  const { rows } = await query(
    'SELECT * FROM code_reviews WHERE session_id = $1 ORDER BY created_at DESC',
    [sessionId],
  );
  return rows.map(toReview);
};

export const findBySessionAndNode = async (sessionId, nodeId) => {
  const { rows } = await query(
    'SELECT * FROM code_reviews WHERE session_id = $1 AND node_id = $2 ORDER BY created_at DESC',
    [sessionId, nodeId],
  );
  return rows.map(toReview);
};

export const findLatestBySessionAndNode = async (sessionId, nodeId) => {
  const { rows } = await query(
    'SELECT * FROM code_reviews WHERE session_id = $1 AND node_id = $2 ORDER BY created_at DESC LIMIT 1',
    [sessionId, nodeId],
  );
  return toReview(rows[0]);
};
