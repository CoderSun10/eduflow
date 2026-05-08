/**
 * 蓝图搜索来源数据访问层（Repository）
 *
 * 存储用于生成蓝图时搜索到的参考资料链接。
 */
import { query } from '../config/database.js';

const toSource = (row) =>
  row
    ? {
        id: row.id,
        sessionId: row.session_id,
        sources: row.sources,
        createdAt: row.created_at,
      }
    : null;

export const findBySession = async (sessionId) => {
  const { rows } = await query(
    'SELECT * FROM blueprint_sources WHERE session_id = $1',
    [sessionId],
  );
  return toSource(rows[0]);
};

export const upsert = async (sessionId, sources) => {
  const { rows } = await query(
    `INSERT INTO blueprint_sources (session_id, sources)
     VALUES ($1, $2)
     ON CONFLICT (session_id)
     DO UPDATE SET sources = $2
     RETURNING *`,
    [sessionId, JSON.stringify(sources)],
  );
  return toSource(rows[0]);
};
