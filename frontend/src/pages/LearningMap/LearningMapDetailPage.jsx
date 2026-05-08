import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Transformer } from "markmap-lib";
import { Markmap } from "markmap-view";
import Button from "../../components/common/Button.jsx";
import { useLearningMap } from "../../hooks/useLearningMap.js";
import { useCreateSession } from "../../hooks/useSession.js";
import { useUiStore } from "../../store/uiStore.js";
import { useTheme } from "../../hooks/useTheme.jsx";
import { RoutePaths } from "../../constants/routes.js";
import { downloadSvgAsImage } from "../../utils/downloadSvgAsImage.js";
import {
  formatDateRange,
  formatDateTime,
  formatElapsedSpan,
} from "../../utils/format.js";
import {
  getSessionDisplaySubtitle,
  getSessionDisplayTitle,
} from "../../utils/sessionDisplay.js";
import styles from "./LearningMapDetailPage.module.css";

const transformer = new Transformer();

const statusLabel = {
  completed: "已掌握",
  in_progress: "学习中",
  recommended: "推荐学习",
  locked: "后续解锁",
};

const statusPrefix = {
  completed: "✅",
  in_progress: "🟦",
  recommended: "✨",
  locked: "🔒",
};

const sessionStatusLabel = {
  active: "学习中",
  paused: "已暂停",
  completed: "已完成",
};

const treeToMarkdown = (node, depth = 0) => {
  if (!node) return "";
  const lines = [];
  const prefix = statusPrefix[node.status]
    ? `${statusPrefix[node.status]} `
    : "";
  lines.push(`${"#".repeat(Math.min(depth + 1, 6))} ${prefix}${node.name}`);
  if (node.description) {
    lines.push(`> ${node.description}`);
  }
  if (node.children?.length) {
    node.children.forEach((child) => {
      lines.push(treeToMarkdown(child, depth + 1));
    });
  }
  return lines.join("\n");
};

const isLeafNode = (node) => !node.children || node.children.length === 0;

const flattenLeafNodes = (node, parentPath = [], acc = []) => {
  if (!node) return acc;
  const currentPath = node.name ? [...parentPath, node.name] : parentPath;
  if (isLeafNode(node)) {
    acc.push({
      id: node.id,
      name: node.name,
      description: node.description,
      status: node.status,
      parentPath: parentPath.join(" → "),
      matchedSessionIds: node.matchedSessionIds ?? [],
    });
  } else {
    node.children?.forEach((child) =>
      flattenLeafNodes(child, currentPath, acc),
    );
  }
  return acc;
};

const toDownloadName = (value) =>
  (value || "learning-map")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 60);

const inferLanguage = (...texts) => {
  const joined = texts.filter(Boolean).join(" ").toLowerCase();
  const languages = [
    "typescript",
    "javascript",
    "python",
    "java",
    "c++",
    "c#",
    "rust",
    "go",
    "react",
    "vue",
    "angular",
    "node.js",
    "php",
    "ruby",
    "swift",
    "kotlin",
    "sql",
    "c",
  ];
  const matched = languages.find((language) => joined.includes(language));
  return matched ? matched.replace("node.js", "Node.js") : "通用编程";
};

const findBestMatchedSessionForNode = (node, sessions) => {
  if (!node.matchedSessionIds?.length) return null;
  const rank = { active: 0, paused: 1, completed: 2, archived: 3 };

  return (
    sessions
      .filter((session) => node.matchedSessionIds.includes(session.id))
      .sort((a, b) => {
        const statusDiff = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
        if (statusDiff !== 0) return statusDiff;
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      })[0] ?? null
  );
};

const LearningMapDetailPage = () => {
  const navigate = useNavigate();
  const { mapId } = useParams();
  const createSession = useCreateSession();
  const startGenerationTask = useUiStore((s) => s.startGenerationTask);
  const failGenerationTask = useUiStore((s) => s.failGenerationTask);
  const svgRef = useRef(null);
  const fullscreenSvgRef = useRef(null);
  const mmRef = useRef(null);
  const fullscreenMmRef = useRef(null);
  const [mapHeight, setMapHeight] = useState(720);
  const [showSourcesModal, setShowSourcesModal] = useState(false);
  const [showNodesModal, setShowNodesModal] = useState(false);
  const [showFullscreenMap, setShowFullscreenMap] = useState(false);
  const [pendingNode, setPendingNode] = useState(null);
  const [launchingNodeId, setLaunchingNodeId] = useState(null);
  const [generatingNodes, setGeneratingNodes] = useState(new Map());
  const { theme } = useTheme();
  const { learningMap, isLoading, error } = useLearningMap(mapId);
  const relatedSessions = learningMap?.relatedSessions ?? [];

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(`${RoutePaths.STATS}?tab=maps`);
  };

  const roadmapNodes = useMemo(
    () => flattenLeafNodes(learningMap?.tree),
    [learningMap],
  );

  const actionableNodes = useMemo(
    () =>
      roadmapNodes.map((node) => ({
        ...node,
        matchedSession: findBestMatchedSessionForNode(node, relatedSessions),
        learningStateLabel: node.matchedSessionIds?.length
          ? statusLabel[node.status] || "学习中"
          : "未学习",
      })),
    [relatedSessions, roadmapNodes],
  );

  useEffect(() => {
    if (!learningMap?.tree || !svgRef.current) return undefined;

    const svg = svgRef.current;
    const syncSvgPresentation = () => {
      const rect = svg.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width || svg.clientWidth || 1));
      const height = Math.max(
        1,
        Math.round(rect.height || svg.clientHeight || 1),
      );
      const rootStyle = window.getComputedStyle(document.documentElement);
      const textColor = rootStyle
        .getPropertyValue("--color-text-strong")
        .trim();
      const lineColor = rootStyle.getPropertyValue("--color-text-muted").trim();

      svg.setAttribute("width", String(width));
      svg.setAttribute("height", String(height));
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

      svg.querySelectorAll("text").forEach((node) => {
        node.setAttribute("fill", textColor);
      });

      svg.querySelectorAll("path,line,polyline,polygon").forEach((node) => {
        if (
          node.getAttribute("stroke") &&
          node.getAttribute("stroke") !== "none"
        ) {
          node.setAttribute("stroke", lineColor);
        }
      });
    };

    svg.innerHTML = "";
    mmRef.current = null;

    const markdown = treeToMarkdown(learningMap.tree);
    const { root } = transformer.transform(markdown);

    mmRef.current = Markmap.create(
      svg,
      {
        autoFit: true,
        duration: 300,
        maxWidth: 260,
        paddingX: 18,
        colorFreezeLevel: 2,
        zoom: false,
        pan: false,
      },
      root,
    );

    const measure = () => {
      const group = svg.querySelector("g");
      const box = group?.getBBox?.();
      if (box?.height) {
        setMapHeight(
          Math.min(1200, Math.max(680, Math.ceil(box.height + 180))),
        );
      } else {
        setMapHeight(720);
      }
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        syncSvgPresentation();
        measure();
      });
    });

    return () => {
      svg.innerHTML = "";
      mmRef.current = null;
    };
  }, [learningMap, theme]);

  useEffect(() => {
    if (!showFullscreenMap || !learningMap?.tree || !fullscreenSvgRef.current)
      return undefined;

    const svg = fullscreenSvgRef.current;
    const rootStyle = window.getComputedStyle(document.documentElement);
    const textColor = rootStyle.getPropertyValue("--color-text-strong").trim();
    const lineColor = rootStyle.getPropertyValue("--color-text-muted").trim();

    svg.innerHTML = "";
    fullscreenMmRef.current = null;

    const markdown = treeToMarkdown(learningMap.tree);
    const { root } = transformer.transform(markdown);

    fullscreenMmRef.current = Markmap.create(
      svg,
      {
        autoFit: true,
        duration: 300,
        maxWidth: 320,
        paddingX: 24,
        colorFreezeLevel: 2,
        zoom: true,
        pan: true,
      },
      root,
    );

    requestAnimationFrame(() => {
      svg.querySelectorAll("text").forEach((node) => {
        node.setAttribute("fill", textColor);
      });
      svg.querySelectorAll("path,line,polyline,polygon").forEach((node) => {
        if (
          node.getAttribute("stroke") &&
          node.getAttribute("stroke") !== "none"
        ) {
          node.setAttribute("stroke", lineColor);
        }
      });
    });

    return () => {
      svg.innerHTML = "";
      fullscreenMmRef.current = null;
    };
  }, [showFullscreenMap, learningMap, theme]);

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingPane}>
          <div className={styles.loadingCard}>
            <div className={styles.loadingSpinner}>
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
            <div className={styles.loadingTitle}>正在加载学习地图</div>
            <div className={styles.loadingDesc}>
              正在获取学习路线与进度数据，请稍候…
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !learningMap) {
    return (
      <div className={styles.page}>
        <div className={styles.stateBox}>
          <div className={styles.stateTitle}>这张学习地图暂时无法打开</div>
          <div className={styles.stateText}>
            可能已被删除，或当前账户没有访问权限。
          </div>
          <button
            type="button"
            className={styles.primaryAction}
            onClick={handleBack}
          >
            返回学习地图列表
          </button>
        </div>
      </div>
    );
  }

  const rawInsights = learningMap.progressInsights;
  const progressInsight =
    typeof rawInsights === "string"
      ? rawInsights
      : Array.isArray(rawInsights)
        ? rawInsights.join(" ")
        : "";
  const title = learningMap.title || learningMap.tree?.name || "学习地图详情";
  const mapTimeline = formatDateRange(
    learningMap.createdAt,
    learningMap.updatedAt,
  );
  const mapDuration = formatElapsedSpan(
    learningMap.createdAt,
    learningMap.updatedAt,
  );

  const handleDownload = async () => {
    await downloadSvgAsImage(svgRef.current, `${toDownloadName(title)}-route`);
  };

  const handleNodeAction = async (node) => {
    if (node.matchedSession) {
      navigate(RoutePaths.workbenchOf(node.matchedSession.id));
      return;
    }
    setPendingNode(node);
  };

  const handleConfirmNodeLaunch = async () => {
    if (!pendingNode) return;
    setLaunchingNodeId(pendingNode.id);
    try {
      const result = await createSession.mutateAsync({
        title: pendingNode.name,
        language: inferLanguage(
          learningMap.title,
          learningMap.goal,
          pendingNode.name,
          pendingNode.description,
          pendingNode.parentPath,
        ),
        intent: [
          learningMap.goal,
          `当前优先学习主题：${pendingNode.name}`,
          pendingNode.parentPath
            ? `在学习路线中的位置：${pendingNode.parentPath}`
            : "",
          pendingNode.description ? `补充说明：${pendingNode.description}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      });
      startGenerationTask({
        kind: "session",
        sessionId: result.session.id,
        title: `正在为「${pendingNode.name}」生成学习蓝图`,
        subjectName: pendingNode.name,
        message:
          "AI 正在根据最新官方文档生成专属知识蓝图，可点击「收起」继续浏览。",
        progress: 5,
        actionLabel: "查看详情",
        actionTo: RoutePaths.workbenchOf(result.session.id),
      });
      setGeneratingNodes((prev) => {
        const next = new Map(prev);
        next.set(pendingNode.id, result.session.id);
        return next;
      });
      setPendingNode(null);
      setShowNodesModal(false);
    } catch (err) {
      failGenerationTask({
        title: `「${pendingNode.name}」创建失败`,
        message: err.message ?? "请稍后重试。",
      });
    } finally {
      setLaunchingNodeId(null);
    }
  };

  return (
    <div className={styles.page}>
      <section className={styles.heroShell}>
        <div className={styles.heroMain}>
          <div className={styles.heroRow}>
            <button
              type="button"
              className={styles.backButton}
              onClick={handleBack}
            >
              返回学习地图
            </button>
            <span className={styles.heroStamp}>已保存路线</span>
          </div>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{learningMap.goal}</p>
          <div className={styles.heroMetaLine}>
            <span>生成时间 {formatDateTime(learningMap.createdAt)}</span>
            <span>最近更新 {formatDateTime(learningMap.updatedAt)}</span>
            <span>持续时间 {mapDuration}</span>
            <span>时间范围 {mapTimeline}</span>
            <span>关联会话 {relatedSessions.length} 个</span>
            <span>路线节点 {roadmapNodes.length} 个</span>
          </div>
        </div>
        <aside className={styles.heroMetaCard}>
          <span className={styles.metaLabel}>知识版本</span>
          <strong className={styles.metaValue}>
            {learningMap.metadata?.version || "未标注"}
          </strong>
          <span className={styles.metaHint}>
            {learningMap.metadata?.versionNote || "系统按最新稳定版资料整理。"}
          </span>
          <button
            type="button"
            className={styles.secondaryAction}
            onClick={() => setShowSourcesModal(true)}
          >
            查看参考资源与版本依据
          </button>
        </aside>
      </section>

      <section className={styles.overviewGrid}>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>学习路线概览</span>
          <strong className={styles.metricValue}>{roadmapNodes.length}</strong>
          <span className={styles.metricHelper}>已展开的核心节点数量</span>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>关联学习进度</span>
          <strong className={styles.metricValue}>
            {relatedSessions.length}
          </strong>
          <span className={styles.metricHelper}>
            当前动态匹配到的相关学习会话
          </span>
        </article>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>行动建议</span>
          <strong className={styles.metricValue}>
            {progressInsight ? "✓" : "—"}
          </strong>
          <span className={styles.metricHelper}>推荐优先推进的学习方向</span>
        </article>
      </section>

      <div
        className={styles.detailGrid}
        style={{ "--map-height": `${mapHeight}px` }}
      >
        <section className={styles.mapCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>学习路线图</h2>
              <p className={styles.sectionSubtitle}>
                {learningMap.metadata?.subjectSummary ||
                  "AI 已为你整理出一条分阶段推进的学习路线。"}
              </p>
            </div>
          </div>
          <div className={styles.legend}>
            <span className={styles.legendItem}>✅ 已掌握</span>
            <span className={styles.legendItem}>🟦 学习中</span>
            <span className={styles.legendItem}>✨ 推荐学习</span>
            <span className={styles.legendItem}>🔒 后续解锁</span>
            <button
              type="button"
              className={styles.legendAction}
              onClick={() => setShowNodesModal(true)}
            >
              查看路线节点
            </button>
          </div>
          <div className={styles.mapViewportWrapper}>
            <div className={styles.mapOverlayActions}>
              <button
                type="button"
                className={styles.mapIconBtn}
                onClick={() => setShowFullscreenMap(true)}
                title="全屏查看"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              </button>
              <button
                type="button"
                className={styles.mapIconBtn}
                onClick={handleDownload}
                title="下载图片"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>
            </div>
            <div className={styles.mapViewport}>
              <svg ref={svgRef} className={styles.markmapSvg} />
            </div>
          </div>
        </section>

        <aside className={styles.sideColumn}>
          <section className={styles.sideCard}>
            <div className={styles.sectionHeaderCompact}>
              <div>
                <h3 className={styles.sideTitle}>学习进度建议</h3>
                <p className={styles.sideSubtitle}>
                  从当前路线中优先推进的重点方向。
                </p>
              </div>
            </div>
            {!progressInsight ? (
              <div className={styles.innerEmpty}>
                这张学习地图暂时没有额外建议。
              </div>
            ) : (
              <div className={styles.insightParagraph}>
                <p className={styles.insightText}>{progressInsight}</p>
              </div>
            )}
          </section>

          <section className={styles.sideCard}>
            <div className={styles.sectionHeaderCompact}>
              <div>
                <h3 className={styles.sideTitle}>关联学习进度</h3>
                <p className={styles.sideSubtitle}>
                  基于当前进行中与已完成会话动态匹配这张学习地图。
                </p>
              </div>
            </div>
            {relatedSessions.length === 0 ? (
              <div className={styles.innerEmpty}>
                当前还没有匹配到与这张学习地图强相关的学习会话。
              </div>
            ) : (
              <div className={styles.sessionList}>
                {relatedSessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    className={styles.sessionCard}
                    onClick={() => navigate(RoutePaths.workbenchOf(session.id))}
                  >
                    <div className={styles.sessionTop}>
                      <span className={styles.sessionState}>
                        {sessionStatusLabel[session.status] || session.status}
                      </span>
                      <span className={styles.sessionPct}>
                        {session.progress}%
                      </span>
                    </div>
                    <div className={styles.sessionTitle}>
                      {getSessionDisplayTitle(session)}
                    </div>
                    <div className={styles.sessionIntent}>
                      {getSessionDisplaySubtitle(session)}
                    </div>
                    <div className={styles.sessionMeta}>
                      <span>
                        {formatDateRange(
                          session.createdAt,
                          session.status === "completed"
                            ? session.completedAt || session.updatedAt
                            : null,
                        )}
                      </span>
                      <span>
                        持续{" "}
                        {formatElapsedSpan(
                          session.createdAt,
                          session.status === "completed"
                            ? session.completedAt || session.updatedAt
                            : null,
                        )}
                      </span>
                    </div>
                    <div className={styles.sessionBar}>
                      <div
                        className={styles.sessionBarFill}
                        style={{ width: `${session.progress}%` }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      {showNodesModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            setShowNodesModal(false);
            setPendingNode(null);
          }}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>路线节点总览</h3>
                <p className={styles.modalSubtitle}>
                  可直接继续已有学习会话，或为尚未开始的主题发起新的知识蓝图。
                </p>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => {
                  setShowNodesModal(false);
                  setPendingNode(null);
                }}
              >
                ×
              </button>
            </div>
            <div className={`${styles.modalBody} ${styles.nodeModalBody}`}>
              <div className={styles.nodeList}>
                {actionableNodes.map((node) => (
                  <div key={node.id} className={styles.nodeItem}>
                    <div className={styles.nodeMeta}>
                      <span className={styles.nodeStatus}>
                        {node.learningStateLabel}
                      </span>
                      <span
                        className={`${styles.nodeSessionState}${
                          generatingNodes.has(node.id)
                            ? ` ${styles.nodeSessionStateGenerating}`
                            : ""
                        }`}
                      >
                        {generatingNodes.has(node.id)
                          ? "生成中"
                          : node.matchedSession
                            ? sessionStatusLabel[node.matchedSession.status] ||
                              node.matchedSession.status
                            : "待生成"}
                      </span>
                    </div>
                    <div className={styles.nodeName}>{node.name}</div>
                    {node.parentPath && (
                      <div className={styles.nodePath}>{node.parentPath}</div>
                    )}
                    {node.description && (
                      <div className={styles.nodeDesc}>{node.description}</div>
                    )}
                    <div className={styles.nodeSessionHint}>
                      {generatingNodes.has(node.id)
                        ? "AI 正在生成知识蓝图，顶部横幅展示实时进度。"
                        : node.matchedSession
                          ? `已匹配会话：${getSessionDisplayTitle(node.matchedSession)}`
                          : "当前还没有与该节点匹配的学习会话。确认后会创建新的知识蓝图，并在页面顶部持续展示生成进度。"}
                    </div>
                    <div className={styles.nodeFooter}>
                      <Button
                        size="sm"
                        variant={
                          node.matchedSession || generatingNodes.has(node.id)
                            ? "secondary"
                            : "primary"
                        }
                        loading={launchingNodeId === node.id}
                        disabled={generatingNodes.has(node.id)}
                        onClick={() =>
                          !generatingNodes.has(node.id) &&
                          handleNodeAction(node)
                        }
                      >
                        {generatingNodes.has(node.id)
                          ? "蓝图生成中…"
                          : node.matchedSession
                            ? node.matchedSession.status === "completed"
                              ? "查看学习记录"
                              : "继续学习"
                            : "确认并开始学习"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {pendingNode && (
        <div
          className={styles.modalOverlay}
          onClick={() => setPendingNode(null)}
        >
          <div
            className={styles.confirmModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>开始新的学习主题</h3>
                <p className={styles.modalSubtitle}>
                  将围绕该节点创建新的知识蓝图，并在生成完成后提示你进入工作台。
                </p>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setPendingNode(null)}
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.confirmCard}>
                <div className={styles.confirmTitle}>{pendingNode.name}</div>
                {pendingNode.parentPath ? (
                  <div className={styles.confirmPath}>
                    {pendingNode.parentPath}
                  </div>
                ) : null}
                {pendingNode.description ? (
                  <p className={styles.confirmText}>
                    {pendingNode.description}
                  </p>
                ) : (
                  <p className={styles.confirmText}>
                    系统会结合整张学习地图的目标，为这个主题生成更聚焦的学习蓝图与首批内容。
                  </p>
                )}
              </div>
              <div className={styles.confirmActions}>
                <Button
                  variant="secondary"
                  onClick={() => setPendingNode(null)}
                  disabled={launchingNodeId === pendingNode.id}
                >
                  稍后再说
                </Button>
                <Button
                  onClick={handleConfirmNodeLaunch}
                  loading={launchingNodeId === pendingNode.id}
                >
                  确认并生成知识蓝图
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSourcesModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowSourcesModal(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>参考资源与版本依据</h3>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setShowSourcesModal(false)}
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              {learningMap.metadata?.officialDocs && (
                <a
                  href={learningMap.metadata.officialDocs}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.resourceLink}
                >
                  官方文档入口
                </a>
              )}
              <ul className={styles.resourceList}>
                {(learningMap.sources ?? []).map((source, index) => (
                  <li
                    key={`${source.url}-${index}`}
                    className={styles.resourceItem}
                  >
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.resourceLink}
                    >
                      {source.title || source.url}
                    </a>
                    {(source.description || source.snippet) && (
                      <p className={styles.resourceDesc}>
                        {source.description || source.snippet}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {showFullscreenMap && (
        <div
          className={styles.fullscreenOverlay}
          onClick={() => setShowFullscreenMap(false)}
        >
          <div
            className={styles.fullscreenMap}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.fullscreenHeader}>
              <h3 className={styles.fullscreenTitle}>学习路线图</h3>
              <p className={styles.fullscreenHint}>可拖拽移动、滚轮缩放</p>
              <button
                type="button"
                className={styles.fullscreenClose}
                onClick={() => setShowFullscreenMap(false)}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className={styles.fullscreenBody}>
              <svg ref={fullscreenSvgRef} className={styles.fullscreenSvg} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LearningMapDetailPage;
