/**
 * AI 对话历史数据访问层（Repository）
 *
 * 持久化存储 AI 助教对话记录，以便用户重新打开页面时恢复对话。
 */
import { query } from '../config/database.js';

const toChat = (row) =>
  row
    ? {
        id: row.id,
        sessionId: row.session_id,
        nodeId: row.node_id,
        messages: row.messages,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;

export const findBySessionAndNode = async (sessionId, nodeId) => {
  const { rows } = await query(
    'SELECT * FROM chat_histories WHERE session_id = $1 AND node_id = $2 ORDER BY updated_at DESC LIMIT 1',
    [sessionId, nodeId ?? null],
  );
  return toChat(rows[0]);
};

export const findBySession = async (sessionId) => {
  const { rows } = await query(
    'SELECT * FROM chat_histories WHERE session_id = $1 ORDER BY updated_at DESC',
    [sessionId],
  );
  return rows.map(toChat);
};

export const upsert = async (sessionId, nodeId, messages) => {
  const existing = await findBySessionAndNode(sessionId, nodeId);

  if (existing) {
    const { rows } = await query(
      `UPDATE chat_histories SET messages = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [JSON.stringify(messages), existing.id],
    );
    return toChat(rows[0]);
  }

  const { rows } = await query(
    `INSERT INTO chat_histories (session_id, node_id, messages)
     VALUES ($1, $2, $3) RETURNING *`,
    [sessionId, nodeId ?? null, JSON.stringify(messages)],
  );
  return toChat(rows[0]);
};

export const remove = async (sessionId) => {
  await query('DELETE FROM chat_histories WHERE session_id = $1', [sessionId]);
};
