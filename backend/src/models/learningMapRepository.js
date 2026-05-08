import { query } from "../config/database.js";

const toLearningMap = (row) =>
  row
    ? {
        id: row.id,
        userId: row.user_id,
        goal: row.goal,
        title: row.title,
        tree: row.payload?.tree ?? null,
        metadata: row.payload?.metadata ?? null,
        progressInsights: row.payload?.progressInsights ?? [],
        sources: row.payload?.sources ?? [],
        relatedSessions: row.payload?.relatedSessions ?? [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;

export const create = async ({
  userId,
  goal,
  title,
  tree,
  metadata,
  progressInsights,
  sources,
  relatedSessions,
}) => {
  const payload = {
    tree,
    metadata,
    progressInsights,
    sources,
    relatedSessions,
  };

  const { rows } = await query(
    `INSERT INTO learning_maps (user_id, goal, title, payload)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, goal, title, JSON.stringify(payload)],
  );

  return toLearningMap(rows[0]);
};

export const findById = async (id) => {
  const { rows } = await query("SELECT * FROM learning_maps WHERE id = $1", [
    id,
  ]);
  return toLearningMap(rows[0]);
};

export const findByUserId = async (userId) => {
  const { rows } = await query(
    "SELECT * FROM learning_maps WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC",
    [userId],
  );
  return rows.map(toLearningMap);
};

export const remove = async (id, userId) => {
  const { rowCount } = await query(
    "DELETE FROM learning_maps WHERE id = $1 AND user_id = $2",
    [id, userId],
  );
  return rowCount > 0;
};
