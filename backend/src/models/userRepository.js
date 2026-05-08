/**
 * 用户数据访问层（Repository）
 *
 * PostgreSQL 实现。
 * 字段对齐 SRS §6.1 user 表结构：
 *   id, email, username, password_hash, learning_focus, created_at, updated_at
 */
import { query } from "../config/database.js";

/** 行映射：snake_case → camelCase */
const toUser = (row) =>
  row
    ? {
        id: row.id,
        email: row.email,
        username: row.username,
        passwordHash: row.password_hash,
        learningFocus: row.learning_focus,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;

export const findById = async (id) => {
  const { rows } = await query("SELECT * FROM users WHERE id = $1", [id]);
  return toUser(rows[0]);
};

export const findByEmail = async (email) => {
  const { rows } = await query("SELECT * FROM users WHERE email = $1", [email]);
  return toUser(rows[0]);
};

export const create = async ({ email, username, passwordHash }) => {
  const { rows } = await query(
    `INSERT INTO users (email, username, password_hash)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [email, username, passwordHash],
  );
  return toUser(rows[0]);
};

export const update = async (id, patch) => {
  const fields = [];
  const values = [];
  let idx = 1;

  if (patch.username !== undefined) {
    fields.push(`username = $${idx++}`);
    values.push(patch.username);
  }
  if (patch.learningFocus !== undefined) {
    fields.push(`learning_focus = $${idx++}`);
    values.push(patch.learningFocus);
  }
  if (patch.passwordHash !== undefined) {
    fields.push(`password_hash = $${idx++}`);
    values.push(patch.passwordHash);
  }

  if (fields.length === 0) return findById(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const { rows } = await query(
    `UPDATE users SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    values,
  );
  return toUser(rows[0]);
};

/**
 * 删除用户所有数据（保留用户账户本身）
 * 按外键依赖顺序删除：练习记录 -> 学习地图 -> 会话相关 -> 会话
 */
export const deleteAllUserData = async (userId) => {
  // 1. 删除练习相关数据
  await query(
    `DELETE FROM practice_answers WHERE practice_session_id IN (SELECT id FROM practice_sessions WHERE user_id = $1)`,
    [userId],
  );
  await query(
    `DELETE FROM practice_questions WHERE practice_session_id IN (SELECT id FROM practice_sessions WHERE user_id = $1)`,
    [userId],
  );
  await query(
    `DELETE FROM wrong_notes WHERE practice_session_id IN (SELECT id FROM practice_sessions WHERE user_id = $1)`,
    [userId],
  );
  await query(
    `DELETE FROM ai_corrections WHERE practice_session_id IN (SELECT id FROM practice_sessions WHERE user_id = $1)`,
    [userId],
  );
  await query(`DELETE FROM practice_sessions WHERE user_id = $1`, [userId]);

  // 2. 删除学习地图
  await query(`DELETE FROM learning_maps WHERE user_id = $1`, [userId]);

  // 3. 删除会话相关数据（节点内容、对话等）
  await query(
    `DELETE FROM node_contents WHERE session_id IN (SELECT id FROM sessions WHERE user_id = $1)`,
    [userId],
  );
  await query(
    `DELETE FROM chat_histories WHERE session_id IN (SELECT id FROM sessions WHERE user_id = $1)`,
    [userId],
  );
  await query(
    `DELETE FROM blueprints WHERE session_id IN (SELECT id FROM sessions WHERE user_id = $1)`,
    [userId],
  );
  await query(
    `DELETE FROM code_reviews WHERE session_id IN (SELECT id FROM sessions WHERE user_id = $1)`,
    [userId],
  );
  await query(
    `DELETE FROM blueprint_sources WHERE session_id IN (SELECT id FROM sessions WHERE user_id = $1)`,
    [userId],
  );
  await query(
    `DELETE FROM generation_progress WHERE session_id IN (SELECT id FROM sessions WHERE user_id = $1)`,
    [userId],
  );
  await query(
    `DELETE FROM chat_histories WHERE session_id IN (SELECT id FROM sessions WHERE user_id = $1)`,
    [userId],
  );
  await query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [userId]);

  // 4. 删除会话本身
  await query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);

  return { deleted: true };
};
