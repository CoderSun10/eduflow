/**
 * 学习会话数据访问层（Repository）
 *
 * PostgreSQL 实现。
 * 表结构参考 SRS §6.1：
 *   sessions(id, user_id, title, language, intent, status, progress, last_node_id,
 *            created_at, updated_at)
 *
 * status 枚举：active | paused | completed | archived
 */
import { query } from "../config/database.js";

/** 行映射：snake_case → camelCase */
const toSession = (row) =>
  row
    ? {
        id: row.id,
        userId: row.user_id,
        title: row.title,
        language: row.language,
        intent: row.intent,
        status: row.status,
        progress: row.progress,
        lastNodeId: row.last_node_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;

export const findById = async (id) => {
  const { rows } = await query("SELECT * FROM sessions WHERE id = $1", [id]);
  return toSession(rows[0]);
};

export const findByUserId = async (userId, { status } = {}) => {
  let sql = "SELECT * FROM sessions WHERE user_id = $1";
  const params = [userId];

  if (status) {
    sql += " AND status = $2";
    params.push(status);
  }

  sql += " ORDER BY updated_at DESC";

  const { rows } = await query(sql, params);
  return rows.map(toSession);
};

export const create = async ({ userId, title, language, intent }) => {
  const { rows } = await query(
    `INSERT INTO sessions (user_id, title, language, intent)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, title, language, intent],
  );
  return toSession(rows[0]);
};

export const update = async (id, patch) => {
  const fields = [];
  const values = [];
  let idx = 1;

  if (patch.title !== undefined) {
    fields.push(`title = $${idx++}`);
    values.push(patch.title);
  }
  if (patch.status !== undefined) {
    fields.push(`status = $${idx++}`);
    values.push(patch.status);
  }
  if (patch.progress !== undefined) {
    fields.push(`progress = $${idx++}`);
    values.push(patch.progress);
  }
  if (patch.lastNodeId !== undefined) {
    fields.push(`last_node_id = $${idx++}`);
    values.push(patch.lastNodeId);
  }

  if (fields.length === 0) return findById(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const { rows } = await query(
    `UPDATE sessions SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    values,
  );
  return toSession(rows[0]);
};

export const remove = async (id) => {
  const { rowCount } = await query("DELETE FROM sessions WHERE id = $1", [id]);
  return rowCount > 0;
};
