import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Transformer } from "markmap-lib";
import { Markmap } from "markmap-view";
import Button from "../../components/common/Button.jsx";
import { useTheme } from "../../hooks/useTheme.jsx";
import { useSpeechRecognition } from "../../hooks/useSpeechRecognition.js";
import {
  useGenerateLearningMap,
  useLearningMap,
  useLearningMaps,
} from "../../hooks/useLearningMap.js";
import {
  getSessionDisplaySubtitle,
  getSessionDisplayTitle,
} from "../../utils/sessionDisplay.js";
import styles from "./LearningMapPage.module.css";

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

const flattenNodes = (node, depth = 0, acc = []) => {
  if (!node) return acc;
  if (depth > 0) {
    acc.push({
      id: node.id,
      name: node.name,
      description: node.description,
      status: node.status,
      depth,
    });
  }
  node.children?.forEach((child) => flattenNodes(child, depth + 1, acc));
  return acc;
};

const formatMapTime = (value) => {
  if (!value) return "刚刚创建";
  return new Date(value).toLocaleString();
};

const MicIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const StopIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

const LearningMapPage = () => {
  const svgRef = useRef(null);
  const mmRef = useRef(null);
  const { theme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const { learningMaps, isLoading: mapsLoading } = useLearningMaps();
  const generateLearningMap = useGenerateLearningMap();
  const [goal, setGoal] = useState("");
  const [mapHeight, setMapHeight] = useState(680);
  const [showSourcesModal, setShowSourcesModal] = useState(false);

  const {
    isRecording,
    isProcessing,
    error: speechError,
    startRecording,
    stopRecording,
  } = useSpeechRecognition();

  const handleVoiceClick = useCallback(async () => {
    if (isRecording) {
      try {
        const text = await stopRecording();
        if (text) {
          setGoal((prev) => (prev ? `${prev} ${text}` : text));
        }
      } catch (err) {
        console.error("语音识别失败", err);
      }
    } else {
      try {
        await startRecording();
      } catch (err) {
        console.error("启动录音失败", err);
      }
    }
  }, [isRecording, startRecording, stopRecording]);
  const selectedMapId = searchParams.get("mapId") || "";
  const effectiveSelectedMapId = selectedMapId || learningMaps[0]?.id || "";
  const { learningMap, isLoading: detailLoading } = useLearningMap(
    effectiveSelectedMapId,
  );

  const selectMap = (mapId) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("mapId", mapId);
      return next;
    });
  };

  const selectedMap = learningMap ?? null;
  const relatedSessions = selectedMap?.relatedSessions ?? [];

  const roadmapNodes = useMemo(
    () => flattenNodes(selectedMap?.tree).slice(0, 40),
    [selectedMap],
  );

  useEffect(() => {
    if (!selectedMap?.tree || !svgRef.current) return undefined;
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
    const markdown = treeToMarkdown(selectedMap.tree);
    const { root } = transformer.transform(markdown);
    mmRef.current = Markmap.create(
      svg,
      {
        autoFit: true,
        duration: 300,
        maxWidth: 260,
        paddingX: 16,
        colorFreezeLevel: 2,
      },
      root,
    );

    const measure = () => {
      const group = svg.querySelector("g");
      const box = group?.getBBox?.();
      if (box?.height) {
        setMapHeight(
          Math.min(1100, Math.max(620, Math.ceil(box.height + 140))),
        );
      } else {
        setMapHeight(680);
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
  }, [selectedMap, theme]);

  const handleGenerate = async () => {
    const trimmed = goal.trim();
    if (!trimmed) return;
    try {
      const data = await generateLearningMap.mutateAsync({ goal: trimmed });
      selectMap(data.id);
      setGoal("");
    } catch (err) {
      console.error("学习地图生成失败", err);
    }
  };

  return (
    <div className={styles.page}>
      <section className={styles.heroShell}>
        <div className={styles.heroContent}>
          <div className={styles.heroEyebrow}>Learning Map Studio</div>
          <h1 className={styles.title}>学习地图</h1>
          <p className={styles.subtitle}>
            把长期学习目标沉淀成可保存、可回看的结构化路线图。每次生成都会保存到数据库，之后你可以随时回到任意一张地图继续查看建议与关联进度。
          </p>
        </div>
        <div className={styles.heroMetaCard}>
          <span className={styles.heroMetaLabel}>已保存地图</span>
          <strong className={styles.heroMetaValue}>
            {learningMaps.length}
          </strong>
          <span className={styles.heroMetaHint}>
            生成结果会持久化保存，下次回来仍可继续查看。
          </span>
        </div>
      </section>

      <section className={styles.controlGrid}>
        <section className={styles.composer}>
          <div className={styles.sectionHeadRow}>
            <div>
              <h2 className={styles.sectionTitle}>创建新的学习地图</h2>
              <p className={styles.sectionSubtitle}>
                直接描述你的长期目标、基础、想掌握的方向或期望产出。
              </p>
            </div>
          </div>
          <div className={styles.inputWrap}>
            <textarea
              className={styles.input}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder={
                isRecording
                  ? "正在录音..."
                  : "例如：我想系统全面学习人工智能研发，从 Python、数学基础、机器学习、深度学习、强化学习到大模型工程与部署全部建立完整体系。"
              }
              disabled={isRecording || isProcessing}
            />
          </div>
          {speechError && (
            <div className={styles.speechError}>{speechError}</div>
          )}
          <div className={styles.composerFooter}>
            <div className={styles.hint}>
              AI
              会优先参考最新官方文档、稳定版说明与现代技术实践，并把结果保存到学习地图历史中。
            </div>
            <div className={styles.composerActions}>
              <button
                type="button"
                className={`${styles.voiceAction} ${isRecording ? styles.recording : ""} ${isProcessing ? styles.processing : ""}`}
                onClick={handleVoiceClick}
                disabled={generateLearningMap.isPending || isProcessing}
                title={isRecording ? "点击停止录音" : "点击开始语音输入"}
              >
                {isProcessing ? (
                  <span className={styles.voiceLoading} />
                ) : isRecording ? (
                  <StopIcon />
                ) : (
                  <MicIcon />
                )}
                <span>
                  {isRecording
                    ? "停止录音"
                    : isProcessing
                      ? "识别中..."
                      : "语音输入"}
                </span>
              </button>
              <Button
                onClick={handleGenerate}
                loading={generateLearningMap.isPending}
              >
                生成并保存学习地图
              </Button>
            </div>
          </div>
        </section>

        <section className={styles.historyPanel}>
          <div className={styles.sectionHeadRow}>
            <div>
              <h2 className={styles.sectionTitle}>已有学习地图</h2>
              <p className={styles.sectionSubtitle}>
                点击任意一张地图即可恢复查看。
              </p>
            </div>
          </div>
          {mapsLoading ? (
            <div className={styles.emptyBox}>正在加载学习地图历史…</div>
          ) : learningMaps.length === 0 ? (
            <div className={styles.emptyBox}>
              你还没有保存过学习地图，先生成第一张吧。
            </div>
          ) : (
            <div className={styles.historyList}>
              {learningMaps.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.historyCard} ${effectiveSelectedMapId === item.id ? styles.historyCardActive : ""}`}
                  onClick={() => selectMap(item.id)}
                >
                  <div className={styles.historyTop}>
                    <span className={styles.historyBadge}>学习地图</span>
                    <span className={styles.historyDate}>
                      {formatMapTime(item.updatedAt)}
                    </span>
                  </div>
                  <div className={styles.historyTitle}>
                    {item.title || item.goal}
                  </div>
                  <div className={styles.historyGoal}>{item.goal}</div>
                </button>
              ))}
            </div>
          )}
        </section>
      </section>

      {generateLearningMap.error && (
        <div className={styles.errorBox}>
          {generateLearningMap.error.message}
        </div>
      )}

      {effectiveSelectedMapId && detailLoading && (
        <div className={styles.emptyBox}>正在恢复这张学习地图…</div>
      )}

      {selectedMap && (
        <>
          <section className={styles.progressPanel}>
            <div className={styles.progressHeader}>
              <div>
                <h2 className={styles.sectionTitle}>当前会话进度反馈</h2>
                <p className={styles.sectionSubtitle}>
                  基于当前进行中与已完成会话动态匹配这张学习地图。
                </p>
              </div>
              <span className={styles.progressCount}>
                关联会话 {relatedSessions.length} 个
              </span>
            </div>
            {relatedSessions.length === 0 ? (
              <div className={styles.emptyBox}>
                当前还没有匹配到与这张学习地图强相关的学习会话。
              </div>
            ) : (
              <div className={styles.sessionGrid}>
                {relatedSessions.map((session) => (
                  <div key={session.id} className={styles.sessionCard}>
                    <div className={styles.sessionTop}>
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
                    <div className={styles.sessionBar}>
                      <div
                        className={styles.sessionBarFill}
                        style={{ width: `${session.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div
            className={styles.resultGrid}
            style={{ "--map-height": `${mapHeight}px` }}
          >
            <section className={styles.mapCard}>
              <div className={styles.mapHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>
                    {selectedMap.title ||
                      selectedMap.tree?.name ||
                      "学习路线图"}
                  </h2>
                  <p className={styles.mapSummary}>
                    {selectedMap.metadata?.subjectSummary ||
                      "AI 已为你整理出一条分阶段推进的学习路线。"}
                  </p>
                </div>
                <div className={styles.versionCard}>
                  <span className={styles.versionLabel}>知识版本</span>
                  <strong className={styles.versionValue}>
                    {selectedMap.metadata?.version || "未标注"}
                  </strong>
                  <span className={styles.versionMeta}>
                    是否最新：
                    {selectedMap.metadata?.isLatestStable === false
                      ? "否"
                      : "是"}
                  </span>
                </div>
              </div>
              <div className={styles.legend}>
                <span className={styles.legendItem}>✅ 已掌握</span>
                <span className={styles.legendItem}>🟦 学习中</span>
                <span className={styles.legendItem}>✨ 推荐学习</span>
                <span className={styles.legendItem}>🔒 后续解锁</span>
              </div>
              <div className={styles.mapViewport}>
                <svg ref={svgRef} className={styles.markmapSvg} />
              </div>
            </section>

            <aside className={styles.sideColumn}>
              <section
                className={`${styles.sideCard} ${styles.progressInsightCard}`}
              >
                <h3 className={styles.sideTitle}>进度建议</h3>
                <div className={styles.insightBody}>
                  {(() => {
                    const raw = selectedMap.progressInsights;
                    const text =
                      typeof raw === "string"
                        ? raw
                        : Array.isArray(raw)
                          ? raw.join(" ")
                          : "";
                    return text ? (
                      <p className={styles.insightText}>{text}</p>
                    ) : (
                      <p className={styles.insightEmpty}>暂无进度建议</p>
                    );
                  })()}
                </div>
              </section>

              <section className={`${styles.sideCard} ${styles.nodeCard}`}>
                <div className={styles.nodeCardHeader}>
                  <h3 className={styles.sideTitle}>路线节点总览</h3>
                  <button
                    type="button"
                    className={styles.resourceTrigger}
                    onClick={() => setShowSourcesModal(true)}
                  >
                    参考资源与版本依据
                  </button>
                </div>
                <div className={styles.nodeScrollArea}>
                  <div className={styles.nodeList}>
                    {roadmapNodes.map((node) => (
                      <div key={node.id} className={styles.nodeItem}>
                        <div className={styles.nodeMeta}>
                          <span className={styles.nodeDepth}>
                            L{node.depth}
                          </span>
                          <span className={styles.nodeStatus}>
                            {statusLabel[node.status] || "规划中"}
                          </span>
                        </div>
                        <div className={styles.nodeName}>{node.name}</div>
                        {node.description && (
                          <div className={styles.nodeDesc}>
                            {node.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </>
      )}

      {showSourcesModal && selectedMap && (
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
                <svg
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="4" y1="4" x2="12" y2="12" />
                  <line x1="12" y1="4" x2="4" y2="12" />
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.versionNote}>
                {selectedMap.metadata?.versionNote ||
                  "系统按最新稳定版资料整理。"}
              </p>
              {selectedMap.metadata?.officialDocs && (
                <a
                  href={selectedMap.metadata.officialDocs}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.resourceLink}
                >
                  官方文档入口
                </a>
              )}
              <ul className={styles.resourceList}>
                {(selectedMap.sources ?? []).map((source, index) => (
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
    </div>
  );
};

export default LearningMapPage;
