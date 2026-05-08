/**
 * AI 纠错 / 解析文本日志 Repository
 *
 * 记录每次 AI 给出的解析、纠错、回顾文本，便于复盘与统计。
 */
import { query } from "../config/database.js";

const toRow = (r) =>
  r
    ? {
        id: r.id,
        userId: r.user_id,
        practiceSessionId: r.practice_session_id,
        sourceSessionId: r.source_session_id,
        scope: r.scope,
        referenceId: r.reference_id,
        request: r.request,
        response: r.response,
        text: r.text,
        createdAt: r.created_at,
      }
    : null;

export const create = async ({
  userId,
  practiceSessionId,
  sourceSessionId,
  scope,
  referenceId,
  request,
  response,
  text,
}) => {
  const { rows } = await query(
    `INSERT INTO ai_corrections
      (user_id, practice_session_id, source_session_id, scope, reference_id,
       request, response, text)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      userId,
      practiceSessionId ?? null,
      sourceSessionId ?? null,
      scope,
      referenceId ?? null,
      JSON.stringify(request ?? {}),
      JSON.stringify(response ?? {}),
      text ?? null,
    ],
  );
  return toRow(rows[0]);
};

export const findByUser = async (userId, { scope, limit = 50 } = {}) => {
  const params = [userId];
  let sql = `SELECT * FROM ai_corrections WHERE user_id = $1`;
  if (scope) {
    params.push(scope);
    sql += ` AND scope = $${params.length}`;
  }
  sql += ` ORDER BY created_at DESC LIMIT ${Number(limit)}`;
  const { rows } = await query(sql, params);
  return rows.map(toRow);
};

export const findByReferences = async (userId, scope, referenceIds = []) => {
  if (!referenceIds.length) return [];

  const { rows } = await query(
    `SELECT * FROM ai_corrections
     WHERE user_id = $1
       AND scope = $2
       AND reference_id = ANY($3::text[])
     ORDER BY created_at DESC`,
    [userId, scope, referenceIds],
  );

  return rows.map(toRow);
};
