import * as aiService from "./aiService.js";
import * as sessionService from "./sessionService.js";
import * as learningMapRepo from "../models/learningMapRepository.js";
import { AppError } from "../utils/AppError.js";
import { ErrorCodes } from "../constants/errorCodes.js";

const GENERIC_TOKENS = new Set([
  "学习",
  "之旅",
  "入门",
  "基础",
  "系统",
  "计划",
  "路线",
  "阶段",
  "知识",
  "实践",
  "项目",
  "目标",
  "能力",
  "核心",
  "提升",
  "综合",
  "专项",
  "learning",
  "study",
  "journey",
  "plan",
  "roadmap",
  "intro",
  "basic",
]);

const SHORT_TECH_TOKENS = new Set(["c", "r", "go", "ai"]);

const assertOwnership = (learningMap, userId) => {
  if (!learningMap || learningMap.userId !== userId) {
    throw new AppError({
      code: ErrorCodes.RESOURCE_NOT_FOUND,
      message: "学习地图不存在",
      status: 404,
    });
  }
};

const toSessionSnapshot = (session) => ({
  id: session.id,
  title: session.title,
  language: session.language,
  intent: session.intent,
  displayTitle: session.displayTitle,
  displaySubtitle: session.displaySubtitle,
  status: session.status,
  progress: session.progress,
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
  completedAt: session.status === "completed" ? session.updatedAt : null,
});

const normalizeText = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s+#.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return [];

  const asciiTokens = normalized.split(/\s+/).filter((token) => {
    if (!token || GENERIC_TOKENS.has(token)) return false;
    if (token.length >= 2) return true;
    return SHORT_TECH_TOKENS.has(token);
  });

  const hanTokens = (normalized.match(/[\p{Script=Han}]{2,}/gu) ?? []).filter(
    (token) => !GENERIC_TOKENS.has(token),
  );

  return [...new Set([...asciiTokens, ...hanTokens])];
};

const collectTreeTexts = (node, acc = []) => {
  if (!node) return acc;
  if (node.name) acc.push(node.name);
  if (node.description) acc.push(node.description);
  node.children?.forEach((child) => collectTreeTexts(child, acc));
  return acc;
};

const buildMapTexts = (learningMap) =>
  [
    learningMap?.title,
    learningMap?.goal,
    learningMap?.metadata?.subjectSummary,
    learningMap?.metadata?.versionNote,
    ...(learningMap?.metadata?.useCases ?? []),
    ...collectTreeTexts(learningMap?.tree),
  ].filter(Boolean);

const hasTokenMatch = (tokens, normalizedText) =>
  tokens.some((token) => normalizedText.includes(token));

const overlapCount = (sourceTokens, targetTokens) =>
  sourceTokens.filter((token) => targetTokens.has(token)).length;

const buildSessionTexts = (session) =>
  [
    session.language,
    session.title,
    session.intent,
    session.displayTitle,
    session.displaySubtitle,
  ].filter(Boolean);

const isSessionRelevantToText = (
  session,
  text,
  tokenSet = null,
  strictMode = false,
) => {
  const sessionTokens = tokenize(buildSessionTexts(session).join(" "));
  if (sessionTokens.length === 0) return false;

  const normalizedText = normalizeText(text);
  if (!normalizedText) return false;

  const targetTokens = tokenSet ?? new Set(tokenize(normalizedText));
  const overlap = overlapCount(sessionTokens, targetTokens);

  // Strict mode: require significant overlap (for leaf node matching)
  if (strictMode) {
    // At least 2 overlapping tokens, or 1 exact keyword match with length >= 4
    const hasKeywordMatch = sessionTokens.some(
      (token) => token.length >= 4 && normalizedText.includes(token),
    );
    return overlap >= 2 || (overlap >= 1 && hasKeywordMatch);
  }

  // Normal mode: any token match
  if (hasTokenMatch(sessionTokens, normalizedText)) {
    return true;
  }
  return overlap >= 2;
};

const sortSessionsByRelevance = (sessions) =>
  [...sessions].sort((a, b) => {
    const rank = { active: 0, paused: 1, completed: 2, archived: 3 };
    const rankDiff = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

const findRelatedSessions = (learningMap, sessions) => {
  const mapTexts = buildMapTexts(learningMap);
  const normalizedMapText = normalizeText(mapTexts.join(" "));
  const mapTokenSet = new Set(tokenize(mapTexts.join(" ")));

  return sortSessionsByRelevance(
    sessions.filter(
      (session) =>
        session.status !== "archived" &&
        isSessionRelevantToText(session, normalizedMapText, mapTokenSet),
    ),
  );
};

const isLeafNode = (node) => !node.children || node.children.length === 0;

const deriveLeafNodeStatus = (currentStatus, matchedSessions) => {
  if (matchedSessions.length === 0) {
    // No matching sessions - keep as recommended/locked, never in_progress
    return currentStatus === "in_progress"
      ? "recommended"
      : currentStatus || "recommended";
  }
  if (matchedSessions.some((s) => s.status === "completed")) {
    return "completed";
  }
  if (
    matchedSessions.some((s) => s.status === "active" || s.status === "paused")
  ) {
    return "in_progress";
  }
  return "recommended";
};

const deriveParentStatus = (currentStatus, childStatuses) => {
  if (childStatuses.length === 0) return currentStatus;
  if (childStatuses.every((s) => s === "completed")) {
    return "completed";
  }
  if (childStatuses.some((s) => s === "completed" || s === "in_progress")) {
    return "in_progress";
  }
  return currentStatus;
};

const syncTreeStatus = (node, sessions) => {
  if (!node) return node;

  if (isLeafNode(node)) {
    const nodeText = [node.name, node.description].filter(Boolean).join(" ");
    // Use strict mode for leaf node matching to avoid false positives
    const matchedSessions = sessions.filter((session) =>
      isSessionRelevantToText(session, nodeText, null, true),
    );
    return {
      ...node,
      status: deriveLeafNodeStatus(node.status, matchedSessions),
      matchedSessionIds: matchedSessions.map((s) => s.id),
    };
  }

  const children = (node.children ?? []).map((child) =>
    syncTreeStatus(child, sessions),
  );

  return {
    ...node,
    status: deriveParentStatus(
      node.status,
      children.map((child) => child.status),
    ),
    children,
  };
};

const collectLeafNodes = (node, acc = []) => {
  if (!node) return acc;
  if (isLeafNode(node)) {
    acc.push(node);
  } else {
    node.children?.forEach((child) => collectLeafNodes(child, acc));
  }
  return acc;
};

const findSessionsMatchingLeafNodesWithAI = async (tree, sessions) => {
  const leafNodes = collectLeafNodes(tree);
  const candidateSessions = sessions.filter((s) => s.status !== "archived");

  if (!candidateSessions.length || !leafNodes.length) {
    return {
      matchedSessions: [],
      nodeMatchMap: new Map(),
      nodeSessionMap: new Map(),
    };
  }

  const aiMatches = await aiService.matchSessionsToNodes(
    candidateSessions,
    leafNodes,
  );

  const matchedSessionIds = new Set();
  const nodeMatchMap = new Map();
  const nodeSessionMap = new Map();

  aiMatches.forEach((match) => {
    matchedSessionIds.add(match.sessionId);
    const session = candidateSessions.find((s) => s.id === match.sessionId);
    if (session && match.matchedNodes) {
      match.matchedNodes.forEach((nodeName) => {
        if (!nodeMatchMap.has(nodeName)) {
          nodeMatchMap.set(nodeName, []);
        }
        if (!nodeSessionMap.has(nodeName)) {
          nodeSessionMap.set(nodeName, []);
        }
        nodeMatchMap.get(nodeName).push(session.status);
        nodeSessionMap.get(nodeName).push(session.id);
      });
    }
  });

  const matchedSessions = sortSessionsByRelevance(
    candidateSessions.filter((s) => matchedSessionIds.has(s.id)),
  );

  return { matchedSessions, nodeMatchMap, nodeSessionMap };
};

const syncTreeStatusWithMatches = (node, nodeMatchMap, nodeSessionMap) => {
  if (!node) return node;

  if (isLeafNode(node)) {
    const matchedStatuses = nodeMatchMap.get(node.name) || [];
    const matchedSessionIds = nodeSessionMap.get(node.name) || [];
    let status = node.status;

    if (matchedStatuses.length === 0) {
      status =
        status === "in_progress" ? "recommended" : status || "recommended";
    } else if (matchedStatuses.includes("completed")) {
      status = "completed";
    } else if (
      matchedStatuses.includes("active") ||
      matchedStatuses.includes("paused")
    ) {
      status = "in_progress";
    } else {
      status = "recommended";
    }

    return { ...node, status, matchedSessionIds };
  }

  const children = (node.children ?? []).map((child) =>
    syncTreeStatusWithMatches(child, nodeMatchMap, nodeSessionMap),
  );

  return {
    ...node,
    status: deriveParentStatus(
      node.status,
      children.map((child) => child.status),
    ),
    children,
  };
};

const enrichLearningMap = async (learningMap, sessions) => {
  const { matchedSessions, nodeMatchMap, nodeSessionMap } =
    await findSessionsMatchingLeafNodesWithAI(learningMap.tree, sessions);

  const syncedTree = syncTreeStatusWithMatches(
    learningMap.tree,
    nodeMatchMap,
    nodeSessionMap,
  );
  const sessionSnapshots = matchedSessions.map(toSessionSnapshot);

  const existingInsights = learningMap.progressInsights;
  const hasExistingInsights =
    typeof existingInsights === "string"
      ? existingInsights.length > 0
      : Array.isArray(existingInsights) && existingInsights.length > 0;

  const shouldRefreshInsights =
    matchedSessions.length > 0 &&
    (!hasExistingInsights ||
      hasSessionStateChanged(learningMap.relatedSessions, sessionSnapshots));

  let progressInsights = existingInsights ?? "";
  if (shouldRefreshInsights) {
    progressInsights = await aiService.generateProgressInsights(
      learningMap.title,
      learningMap.goal,
      syncedTree,
      sessionSnapshots,
    );
  }

  return {
    ...learningMap,
    tree: syncedTree,
    relatedSessions: sessionSnapshots,
    progressInsights,
  };
};

const hasSessionStateChanged = (oldSessions, newSessions) => {
  if (!oldSessions || oldSessions.length !== newSessions.length) return true;
  const oldMap = new Map(oldSessions.map((s) => [s.id, s]));
  return newSessions.some((newS) => {
    const oldS = oldMap.get(newS.id);
    return (
      !oldS || oldS.status !== newS.status || oldS.progress !== newS.progress
    );
  });
};

export const generateLearningMap = async (userId, goal) => {
  const sessions = await sessionService.listSessions(userId);
  const currentSessions = sessions.filter(
    (session) => session.status === "active" || session.status === "paused",
  );
  const data = await aiService.generateLearningMap(goal, currentSessions);
  const title = data.tree?.name || goal.slice(0, 80);

  return learningMapRepo.create({
    userId,
    goal,
    title,
    tree: data.tree,
    metadata: data.metadata,
    progressInsights: data.progressInsights ?? [],
    sources: data.sources ?? [],
    relatedSessions: currentSessions.map(toSessionSnapshot),
  });
};

export const listLearningMaps = async (userId) => {
  return learningMapRepo.findByUserId(userId);
};

export const getLearningMap = async (userId, mapId) => {
  const learningMap = await learningMapRepo.findById(mapId);
  assertOwnership(learningMap, userId);
  const sessions = await sessionService.listSessions(userId);
  const relevantSessions = sessions.filter(
    (session) =>
      session.status === "active" ||
      session.status === "paused" ||
      session.status === "completed",
  );

  return await enrichLearningMap(learningMap, relevantSessions);
};

export const deleteLearningMap = async (userId, mapId) => {
  const learningMap = await learningMapRepo.findById(mapId);
  assertOwnership(learningMap, userId);
  await learningMapRepo.remove(mapId, userId);
};
