/**
 * 生成进度 Repository
 *
 * 跟踪蓝图 / 节点内容 / 原子练习的预生成状态，前端通过 SSE 拉取实时进度。
 *
 * scope 值：
 *   blueprint           — 蓝图本身
 *   node_content        — 某个知识节点的学习内容
 *   atomic_practice     — 某个原子知识点的专项练习题组
 */
import { query } from "../config/database.js";

const toRow = (r) =>
  r
    ? {
        id: r.id,
        sessionId: r.session_id,
        scope: r.scope,
        referenceId: r.reference_id,
        status: r.status,
        detail: r.detail,
        error: r.error,
        startedAt: r.started_at,
        finishedAt: r.finished_at,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }
    : null;

export const upsert = async ({
  sessionId,
  scope,
  referenceId,
  status,
  detail,
  error,
}) => {
  const { rows } = await query(
    `INSERT INTO generation_progress (session_id, scope, reference_id, status, detail, error,
                                       started_at, finished_at)
     VALUES ($1, $2, $3, $4::text, $5, $6,
             CASE WHEN $4::text = 'running' THEN NOW() ELSE NULL END,
             CASE WHEN $4::text IN ('done', 'failed') THEN NOW() ELSE NULL END)
     ON CONFLICT (session_id, scope, reference_id)
     DO UPDATE SET
       status = EXCLUDED.status,
       detail = EXCLUDED.detail,
       error = EXCLUDED.error,
       started_at = COALESCE(generation_progress.started_at,
                             CASE WHEN EXCLUDED.status = 'running' THEN NOW() ELSE NULL END),
       finished_at = CASE WHEN EXCLUDED.status IN ('done', 'failed') THEN NOW()
                          ELSE generation_progress.finished_at END,
       updated_at = NOW()
     RETURNING *`,
    [
      sessionId,
      scope,
      referenceId,
      status ?? "pending",
      JSON.stringify(detail ?? {}),
      error ?? null,
    ],
  );
  return toRow(rows[0]);
};

export const findBySession = async (sessionId) => {
  const { rows } = await query(
    `SELECT * FROM generation_progress WHERE session_id = $1 ORDER BY created_at`,
    [sessionId],
  );
  return rows.map(toRow);
};

export const summarize = async (sessionId) => {
  const { rows } = await query(
    `SELECT scope, status, COUNT(*)::int AS cnt
     FROM generation_progress WHERE session_id = $1
     GROUP BY scope, status`,
    [sessionId],
  );
  return rows;
};
