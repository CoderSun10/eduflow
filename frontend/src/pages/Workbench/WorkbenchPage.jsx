/**
 * 学习工作台页面（三栏布局骨架）
 *
 * 顶部面包屑 + 左中右三栏：
 *   - <KnowledgeTreePanel />   左侧蓝图导航
 *   - <LearningContent />      中部知识点内容（讲解 / 例题 / 代码实践）
 *   - <AIAssistantPanel />     右侧 AI 分析、掌握度认证、历史记忆
 *
 * 会话 & 蓝图数据通过 hook 从后端获取，子组件接收 props。
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RoutePaths } from "../../constants/routes.js";
import { useSession } from "../../hooks/useSession.js";
import { useBlueprint, useAdvanceNode } from "../../hooks/useBlueprint.js";
import KnowledgeTreePanel from "./components/KnowledgeTreePanel.jsx";
import LearningContent from "./components/LearningContent.jsx";
import AIAssistantPanel from "./components/AIAssistantPanel.jsx";
import BlueprintModal from "./components/BlueprintModal.jsx";
import styles from "./WorkbenchPage.module.css";

/** 递归搜索树中状态为 active 的叶子节点 */
const findActiveNode = (blueprint) => {
  if (!blueprint?.tree) return { node: null, nodePath: "" };

  const search = (treeNode, path = []) => {
    const currentPath = [...path, treeNode.name];
    if (treeNode.status === "active") {
      return { node: treeNode, nodePath: currentPath.join(" → ") };
    }
    if (treeNode.children) {
      for (const child of treeNode.children) {
        const result = search(child, currentPath);
        if (result) return result;
      }
    }
    return null;
  };

  return search(blueprint.tree) ?? { node: null, nodePath: "" };
};

/** 递归搜索树中指定 ID 的节点 */
const findNodeById = (tree, targetId, path = []) => {
  if (!tree) return null;
  const currentPath = [...path, tree.name];
  if (tree.id === targetId) {
    return { node: tree, nodePath: currentPath.join(" → ") };
  }
  if (tree.children) {
    for (const child of tree.children) {
      const result = findNodeById(child, targetId, currentPath);
      if (result) return result;
    }
  }
  return null;
};

const WorkbenchPage = () => {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const { session, isLoading: sessionLoading } = useSession(sessionId);
  const {
    blueprint,
    isLoading: blueprintLoading,
    error: blueprintError,
    refetch: refetchBlueprint,
  } = useBlueprint(sessionId, {
    retry: 0,
  });
  const advanceNode = useAdvanceNode(sessionId);

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [showBlueprintModal, setShowBlueprintModal] = useState(false);
  const [rightWidth, setRightWidth] = useState(300);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const dragging = useRef(false);

  const isLoading = sessionLoading || blueprintLoading;

  useEffect(() => {
    if (!sessionId || blueprint || blueprintLoading) return undefined;

    const timer = window.setInterval(() => {
      refetchBlueprint();
    }, 1500);

    return () => {
      window.clearInterval(timer);
    };
  }, [sessionId, blueprint, blueprintLoading, refetchBlueprint]);

  // ── 右栏拖拽调宽 ──
  const handleDragStart = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    const onMove = (ev) => {
      if (!dragging.current) return;
      const newW = window.innerWidth - ev.clientX;
      setRightWidth(Math.max(220, Math.min(480, newW)));
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const { node: activeNode, nodePath: activeNodePath } =
    findActiveNode(blueprint);
  const currentNodeId = selectedNodeId ?? activeNode?.id;

  // 找到当前选中的节点信息
  let currentNode = activeNode;
  let currentNodePath = activeNodePath;
  if (selectedNodeId && blueprint?.tree) {
    const found = findNodeById(blueprint.tree, selectedNodeId);
    if (found) {
      currentNode = found.node;
      currentNodePath = found.nodePath;
    }
  }

  const handleNodeSelect = (nodeId) => {
    setSelectedNodeId(nodeId);
  };

  const handleAdvanceNode = async (nodeId, status) => {
    try {
      await advanceNode.mutateAsync({ nodeId, status });
    } catch (err) {
      console.error("[workbench] 更新节点失败", err);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.wb}>
        <div className={styles.loading}>加载中…</div>
      </div>
    );
  }

  if (!blueprint) {
    const isBlueprintPending =
      blueprintError?.status === 404 || !blueprintError;

    return (
      <div className={styles.wb}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.back}
            aria-label="返回主页"
            onClick={() => navigate(RoutePaths.HOME)}
          >
            <svg
              viewBox="0 0 13 13"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <path d="M8 2L4 6.5 8 11" />
            </svg>
          </button>
          <nav className={styles.breadcrumb} aria-label="面包屑">
            {session?.language ?? "—"} <span className={styles.sep}>/</span>
            <span className={styles.current}>
              {session?.title ?? "正在准备工作台"}
            </span>
          </nav>
          <div className={styles.spacer} />
        </header>

        <div className={styles.loadingPane}>
          <div className={styles.loadingCard}>
            <div className={styles.loadingSpinner}>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div className={styles.loadingTitle}>
              {isBlueprintPending ? "AI 正在准备工作台" : "工作台加载失败"}
            </div>
            <div className={styles.loadingDesc}>
              {isBlueprintPending
                ? "知识蓝图刚生成完成，页面正在等待蓝图结构与首批学习内容同步到工作台。"
                : (blueprintError?.message ?? "请稍后重试。")}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wb}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.back}
          aria-label="返回主页"
          onClick={() => navigate(RoutePaths.HOME)}
        >
          <svg
            viewBox="0 0 13 13"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M8 2L4 6.5 8 11" />
          </svg>
        </button>

        <nav className={styles.breadcrumb} aria-label="面包屑">
          {session?.language ?? "—"} <span className={styles.sep}>/</span>
          <span className={styles.current}>
            {currentNode?.name ?? session?.title ?? "—"}
          </span>
        </nav>
        <span className={styles.tag}>{currentNodePath || "—"}</span>

        <div className={styles.spacer} />

        <div className={styles.progressWrap}>
          <span className={styles.progressLabel}>总进度</span>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${session?.progress ?? 0}%` }}
            />
          </div>
          <span className={styles.progressPct}>{session?.progress ?? 0}%</span>
        </div>
      </header>

      <div
        className={styles.body}
        style={{
          gridTemplateColumns: rightCollapsed
            ? "196px 1fr 20px"
            : `196px 1fr ${rightWidth}px`,
        }}
      >
        <KnowledgeTreePanel
          blueprint={blueprint}
          activeNodeId={currentNodeId}
          onNodeSelect={handleNodeSelect}
          onOpenMap={() => setShowBlueprintModal(true)}
        />
        <LearningContent
          node={currentNode}
          nodePath={currentNodePath}
          sessionId={sessionId}
          language={session?.language}
          onAdvance={handleAdvanceNode}
        />

        {/* ── 右栏（含拖拽边框 + 收起按钮） ── */}
        <div className={styles.rightArea} style={{ position: "relative" }}>
          {!rightCollapsed && (
            <>
              <div
                className={styles.resizeHandle}
                onMouseDown={handleDragStart}
                title="拖拽调整宽度"
              />
              <AIAssistantPanel session={session} currentNode={currentNode} />
            </>
          )}
          <button
            type="button"
            className={styles.collapseBtn}
            onClick={() => setRightCollapsed((v) => !v)}
            title={rightCollapsed ? "展开面板" : "收起面板"}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              {rightCollapsed ? (
                <path d="M4 2l4 4-4 4" />
              ) : (
                <path d="M8 2L4 6l4 4" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {showBlueprintModal && (
        <BlueprintModal
          blueprint={blueprint}
          activeNodeId={currentNodeId}
          onNodeSelect={handleNodeSelect}
          onClose={() => setShowBlueprintModal(false)}
        />
      )}
    </div>
  );
};

export default WorkbenchPage;
