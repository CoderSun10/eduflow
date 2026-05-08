/**
 * 知识蓝图数据访问层（Repository）
 *
 * PostgreSQL 实现。
 * 蓝图 = 一个学习会话的知识图谱，以树状结构（思维导图）存储。
 * tiers 字段存储完整的树状 JSON（复用已有字段名，内容为树结构）。
 *
 * 数据结构：
 *   blueprint(id, session_id, tiers: JSONB, created_at, updated_at)
 *   tiers 字段实际存储 { tree: {...}, metadata: {...} }
 *
 * node.status 枚举：done | active | pending
 */
import { query } from "../config/database.js";

/** 行映射：snake_case → camelCase */
const toBlueprint = (row) =>
  row
    ? {
        id: row.id,
        sessionId: row.session_id,
        tree: row.tiers?.tree ?? row.tiers,
        metadata: row.tiers?.metadata ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;

export const findBySessionId = async (sessionId) => {
  const { rows } = await query(
    "SELECT * FROM blueprints WHERE session_id = $1",
    [sessionId],
  );
  return toBlueprint(rows[0]);
};

export const create = async ({ sessionId, tree, metadata }) => {
  // 为所有节点设置初始状态
  const enrichedTree = initTreeStatuses(tree);

  const data = { tree: enrichedTree, metadata };

  const { rows } = await query(
    `INSERT INTO blueprints (session_id, tiers)
     VALUES ($1, $2)
     RETURNING *`,
    [sessionId, JSON.stringify(data)],
  );
  return toBlueprint(rows[0]);
};

export const update = async (sessionId, patch) => {
  const current = await findBySessionId(sessionId);
  if (!current) return null;

  const data = {
    tree: patch.tree ?? current.tree,
    metadata: patch.metadata ?? current.metadata,
  };

  const { rows } = await query(
    `UPDATE blueprints SET tiers = $1, updated_at = NOW() WHERE session_id = $2 RETURNING *`,
    [JSON.stringify(data), sessionId],
  );
  return toBlueprint(rows[0]);
};

/**
 * 递归初始化树节点状态
 * 第一个叶子节点设为 active，其余全部为 pending（无锁定）
 */
function initTreeStatuses(node, depth = 0, ctx = { foundFirst: false }) {
  if (!node) return node;

  const children = node.children ?? [];

  if (children.length === 0) {
    // 叶子节点：第一个设为 active，其余 pending
    const status = !ctx.foundFirst ? "active" : "pending";
    if (!ctx.foundFirst) ctx.foundFirst = true;
    return { ...node, status };
  }

  return {
    ...node,
    status: undefined,
    children: children.map((child) => initTreeStatuses(child, depth + 1, ctx)),
  };
}

/**
 * 递归更新树中某个节点的状态
 */
function updateTreeNodeStatus(node, targetId, newStatus) {
  if (!node) return { node, found: false };

  if (node.id === targetId) {
    return { node: { ...node, status: newStatus }, found: true };
  }

  if (!node.children || node.children.length === 0) {
    return { node, found: false };
  }

  let found = false;
  const updatedChildren = node.children.map((child) => {
    if (found) return child;
    const result = updateTreeNodeStatus(child, targetId, newStatus);
    if (result.found) found = true;
    return result.node;
  });

  return { node: { ...node, children: updatedChildren }, found };
}

/**
 * 递归查找树中的节点
 */
function findNodeInTree(node, targetId, path = []) {
  if (!node) return null;

  const currentPath = [...path, node.name];

  if (node.id === targetId) {
    return { ...node, nodePath: currentPath.join(" → ") };
  }

  if (!node.children) return null;

  for (const child of node.children) {
    const result = findNodeInTree(child, targetId, currentPath);
    if (result) return result;
  }

  return null;
}

/**
 * 在树中更新节点状态并自动解锁相邻节点
 */
export const updateNodeStatus = async (sessionId, nodeId, status) => {
  const blueprint = await findBySessionId(sessionId);
  if (!blueprint) return null;

  const { node: updatedTree, found } = updateTreeNodeStatus(
    blueprint.tree,
    nodeId,
    status,
  );

  if (!found) return null;

  return update(sessionId, { tree: updatedTree });
};

/** 找到蓝图中的某个具体节点 */
export const findNode = async (sessionId, nodeId) => {
  const blueprint = await findBySessionId(sessionId);
  if (!blueprint || !blueprint.tree) return null;
  return findNodeInTree(blueprint.tree, nodeId);
};

/**
 * 计算整体进度（完成的叶子节点 / 总叶子节点）
 */
export const calcProgress = (tree) => {
  let total = 0;
  let done = 0;

  function traverse(node) {
    if (!node) return;
    if (!node.children || node.children.length === 0) {
      // 叶子节点
      total++;
      if (node.status === "done") done++;
      return;
    }
    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(tree);
  return total === 0 ? 0 : Math.round((done / total) * 100);
};

export const remove = async (sessionId) => {
  await query("DELETE FROM blueprints WHERE session_id = $1", [sessionId]);
};
