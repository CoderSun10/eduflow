/**
 * 节点学习内容缓存数据访问层（Repository）
 *
 * 存储 AI 生成的节点内容，避免重复调用 DeepSeek API。
 * 数据结构：node_contents(id, session_id, node_id, content: JSONB, created_at, updated_at)
 */
import { query } from "../config/database.js";

const toNodeContent = (row) =>
  row
    ? {
        id: row.id,
        sessionId: row.session_id,
        nodeId: row.node_id,
        content: row.content,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;

export const findBySessionAndNode = async (sessionId, nodeId) => {
  const { rows } = await query(
    "SELECT * FROM node_contents WHERE session_id = $1 AND node_id = $2",
    [sessionId, nodeId],
  );
  return toNodeContent(rows[0]);
};

export const upsert = async (sessionId, nodeId, content) => {
  const { rows } = await query(
    `INSERT INTO node_contents (session_id, node_id, content)
     VALUES ($1, $2, $3)
     ON CONFLICT (session_id, node_id)
     DO UPDATE SET content = $3, updated_at = NOW()
     RETURNING *`,
    [sessionId, nodeId, JSON.stringify(content)],
  );
  return toNodeContent(rows[0]);
};
