/**
 * 学习统计页（合并原 Sessions + History + Reports）
 *
 * 顶部：数据概览卡片
 * Tab 1: 会话管理 — 所有会话列表，支持筛选、删除、继续学习
 * Tab 2: 数据报告 — 语言分布、学习建议
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Button from "../../components/common/Button.jsx";
import {
  useSessions,
  useDeleteSession,
  useUpdateSession,
} from "../../hooks/useSession.js";
import {
  useDeleteLearningMap,
  useLearningMaps,
} from "../../hooks/useLearningMap.js";
import { blueprintApi } from "../../api/blueprintApi.js";
import {
  formatDateTime,
  formatDateRange,
  formatElapsedSpan,
  formatRelativeTime,
} from "../../utils/format.js";
import { RoutePaths } from "../../constants/routes.js";
import {
  getSessionDisplaySubtitle,
  getSessionDisplayTitle,
} from "../../utils/sessionDisplay.js";
import styles from "./StudyStatsPage.module.css";

const STATUS_TABS = [
  { key: "all", label: "全部" },
  { key: "active", label: "进行中" },
  { key: "paused", label: "已暂停" },
  { key: "completed", label: "已完成" },
];

const statusLabel = (status) => {
  const map = {
    active: "进行中",
    paused: "已暂停",
    completed: "已完成",
    archived: "已归档",
  };
  return map[status] ?? status;
};

const MAIN_TABS = [
  { key: "sessions", label: "会话管理" },
  { key: "maps", label: "地图管理" },
  { key: "report", label: "数据报告" },
];

const SOURCE_TYPE_LABEL = {
  doc: "官方文档",
  book: "书籍",
  tutorial: "教程",
  video: "视频",
};

const collectLeafNames = (node, acc = []) => {
  if (!node) return acc;
  if (!node.children?.length) {
    acc.push(node.name);
    return acc;
  }
  node.children.forEach((child) => collectLeafNames(child, acc));
  return acc;
};

const StudyStatsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { sessions, isLoading } = useSessions();
  const { learningMaps, isLoading: mapsLoading } = useLearningMaps();
  const deleteSession = useDeleteSession();
  const deleteLearningMap = useDeleteLearningMap();
  const updateSession = useUpdateSession();
  const [statusTab, setStatusTab] = useState("all");
  const [sourcesPopup, setSourcesPopup] = useState(null);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [renamingSession, setRenamingSession] = useState(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [renameError, setRenameError] = useState("");
  const [detailPopup, setDetailPopup] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const activeTab = searchParams.get("tab");
  const mainTab = MAIN_TABS.some((item) => item.key === activeTab)
    ? activeTab
    : "sessions";

  // ── 统计数据 ──
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter(
    (s) => s.status === "completed",
  ).length;
  const activeSessions = sessions.filter(
    (s) => s.status === "active" || s.status === "paused",
  ).length;
  const avgProgress =
    totalSessions > 0
      ? Math.round(
          sessions.reduce((sum, s) => sum + (s.progress ?? 0), 0) /
            totalSessions,
        )
      : 0;
  const totalMaps = learningMaps.length;

  // ── 会话筛选 ──
  const filtered =
    statusTab === "all"
      ? sessions
      : sessions.filter((s) => s.status === statusTab);

  useEffect(() => {
    if (!menuOpenId) return undefined;
    const handleWindowClick = () => setMenuOpenId(null);
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, [menuOpenId]);

  const detailSummary = useMemo(() => {
    if (!detailPopup?.blueprint || !detailPopup?.session) return null;
    const { blueprint, session, sources } = detailPopup;
    const topModules = blueprint.tree?.children ?? [];
    const knowledgeNames = collectLeafNames(blueprint.tree).slice(0, 18);
    const moduleNames = topModules.map((item) => item.name).slice(0, 8);
    const moduleDescriptions = topModules
      .map((item) => item.description)
      .filter(Boolean)
      .slice(0, 3);
    const metadata = blueprint.metadata ?? {};
    const displayTitle = getSessionDisplayTitle(session);
    return {
      summary:
        metadata.subjectSummary ||
        `${displayTitle} 围绕你的学习目标展开，帮助你从基础概念、核心模块到进阶实践形成完整学习路径。`,
      version: metadata.version || "未记录版本号",
      latestStatus:
        metadata.isLatestStable === false
          ? "否，建议重新生成以对齐最新稳定版本"
          : metadata.version
            ? "是，当前会话按最新稳定版资料整理"
            : "未明确标注，建议结合官方文档再次确认",
      versionNote:
        metadata.versionNote ||
        "系统默认优先检索最新官方文档、稳定版说明与现代最佳实践后生成本会话蓝图。",
      officialDocs: metadata.officialDocs,
      modules: moduleNames,
      knowledge: knowledgeNames,
      useCases:
        metadata.useCases?.length > 0
          ? metadata.useCases.slice(0, 4)
          : moduleDescriptions.length > 0
            ? moduleDescriptions
            : [
                `用于系统掌握 ${displayTitle} 的核心知识结构`,
                `用于围绕当前学习目标构建可执行学习路线`,
                "用于后续专项练习、项目挑战和知识查漏补缺",
              ],
      sourceCount: sources?.length ?? 0,
    };
  }, [detailPopup]);

  const handleDelete = async (id) => {
    if (!window.confirm("确定要删除这个会话吗？")) return;
    try {
      await deleteSession.mutateAsync(id);
      setMenuOpenId(null);
    } catch (err) {
      console.error("删除失败", err);
    }
  };

  const handleDeleteMap = async (id, title) => {
    if (!window.confirm(`确定要删除学习地图「${title}」吗？`)) return;
    try {
      await deleteLearningMap.mutateAsync(id);
      setMenuOpenId(null);
    } catch (err) {
      console.error("删除学习地图失败", err);
    }
  };

  const handleMainTabChange = (tab) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (tab === "sessions") {
      nextSearchParams.delete("tab");
    } else {
      nextSearchParams.set("tab", tab);
    }
    setSearchParams(nextSearchParams);
    setMenuOpenId(null);
  };

  const handleShowSources = async (session) => {
    setSourcesLoading(true);
    setMenuOpenId(null);
    try {
      const data = await blueprintApi.getSources(session.id);
      setSourcesPopup({
        title: getSessionDisplayTitle(session),
        sources: data?.sources ?? [],
      });
    } catch {
      setSourcesPopup({ title: getSessionDisplayTitle(session), sources: [] });
    } finally {
      setSourcesLoading(false);
    }
  };

  const handleOpenDetail = async (session) => {
    setDetailLoading(true);
    setMenuOpenId(null);
    try {
      const [blueprint, sourceData] = await Promise.all([
        blueprintApi.get(session.id),
        blueprintApi.getSources(session.id),
      ]);
      setDetailPopup({
        session,
        blueprint,
        sources: sourceData?.sources ?? [],
      });
    } catch (err) {
      console.error("加载会话详情失败", err);
      setDetailPopup({
        session,
        blueprint: null,
        sources: [],
        error: err.message,
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenRename = (session) => {
    setMenuOpenId(null);
    setRenameError("");
    setRenameTitle(getSessionDisplayTitle(session));
    setRenamingSession(session);
  };

  const handleRenameSubmit = async () => {
    const title = renameTitle.trim();
    if (!renamingSession) return;
    if (!title) {
      setRenameError("会话名称不能为空");
      return;
    }
    if (title.length > 120) {
      setRenameError("会话名称不能超过 120 个字符");
      return;
    }
    try {
      await updateSession.mutateAsync({ id: renamingSession.id, title });
      setRenamingSession(null);
      setRenameTitle("");
      setRenameError("");
    } catch (err) {
      setRenameError(err.message || "会话名称修改失败");
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>学习统计</h1>
        <p className={styles.subtitle}>
          管理你的学习会话与学习地图，查看学习数据
        </p>
      </header>

      {/* ── 数据概览 ── */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statNum}>{totalSessions}</div>
          <div className={styles.statLabel}>总会话数</div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statNum} ${styles.statActive}`}>
            {activeSessions}
          </div>
          <div className={styles.statLabel}>进行中</div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statNum} ${styles.statDone}`}>
            {completedSessions}
          </div>
          <div className={styles.statLabel}>已完成</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNum}>{avgProgress}%</div>
          <div className={styles.statLabel}>平均进度</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNum}>{totalMaps}</div>
          <div className={styles.statLabel}>已保存地图</div>
        </div>
      </div>

      {/* ── 主 Tab 切换 ── */}
      <div className={styles.mainTabs}>
        {MAIN_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`${styles.mainTab} ${mainTab === t.key ? styles.mainTabActive : ""}`}
            onClick={() => handleMainTabChange(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mainTab === "sessions" && isLoading ? (
        <div className={styles.empty}>加载中…</div>
      ) : mainTab === "sessions" ? (
        /* ── 会话管理 Tab ── */
        <>
          <div className={styles.filterRow}>
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`${styles.chip} ${statusTab === t.key ? styles.chipActive : ""}`}
                onClick={() => setStatusTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className={styles.empty}>
              {statusTab === "all"
                ? "还没有会话，从主页创建你的第一个学习计划吧"
                : "没有符合条件的会话"}
            </div>
          ) : (
            <div className={styles.list}>
              {filtered.map((s) => {
                const displayTitle = getSessionDisplayTitle(s);
                const displaySubtitle = getSessionDisplaySubtitle(s);
                const sessionMenuId = `session-${s.id}`;

                return (
                  <article
                    key={s.id}
                    className={`${styles.card} ${menuOpenId === sessionMenuId ? styles.cardMenuOpen : ""}`}
                    onClick={() => navigate(RoutePaths.workbenchOf(s.id))}
                  >
                    <div className={styles.cardTop}>
                      <span
                        className={`${styles.status} ${styles[`status_${s.status}`] ?? ""}`}
                      >
                        {statusLabel(s.status)}
                      </span>
                      <div className={styles.menuWrap}>
                        <button
                          type="button"
                          className={styles.sourceBtn}
                          title="更多操作"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId((prev) =>
                              prev === sessionMenuId ? null : sessionMenuId,
                            );
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <circle cx="12" cy="5" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="12" cy="19" r="2" />
                          </svg>
                        </button>
                        {menuOpenId === sessionMenuId && (
                          <div
                            className={styles.menuPanel}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className={styles.menuItem}
                              onClick={() => handleOpenDetail(s)}
                            >
                              查看详情
                            </button>
                            <button
                              type="button"
                              className={styles.menuItem}
                              onClick={() => handleOpenRename(s)}
                            >
                              编辑名称
                            </button>
                            <button
                              type="button"
                              className={styles.menuItem}
                              onClick={() => handleShowSources(s)}
                            >
                              参考资源
                            </button>
                            <button
                              type="button"
                              className={`${styles.menuItem} ${styles.menuDanger}`}
                              onClick={() => handleDelete(s.id)}
                            >
                              删除会话
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <h3 className={styles.cardTitle}>{displayTitle}</h3>
                    <p className={styles.cardIntent}>{displaySubtitle}</p>
                    <div className={styles.cardBottom}>
                      <div className={styles.progressWrap}>
                        <div className={styles.progressBar}>
                          <div
                            className={styles.progressFill}
                            style={{ width: `${s.progress}%` }}
                          />
                        </div>
                        <span className={styles.progressPct}>
                          {s.progress}%
                        </span>
                      </div>
                      <span className={styles.time}>
                        {formatRelativeTime(s.updatedAt)}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : mainTab === "maps" ? (
        /* ── 地图管理 Tab ── */
        mapsLoading ? (
          <div className={styles.empty}>正在加载学习地图…</div>
        ) : learningMaps.length === 0 ? (
          <div className={styles.emptyPanel}>
            <div className={styles.emptyTitle}>还没有保存的学习地图</div>
            <div className={styles.emptyText}>
              去学习地图页描述你的长期学习目标，生成后会自动保存到这里。
            </div>
            <div className={styles.emptyActions}>
              <Button onClick={() => navigate(RoutePaths.LEARNING_MAP)}>
                去创建学习地图
              </Button>
            </div>
          </div>
        ) : (
          <div className={styles.list}>
            {learningMaps.map((map) => {
              const mapMenuId = `map-${map.id}`;
              return (
                <article
                  key={map.id}
                  className={`${styles.card} ${styles.mapCard} ${menuOpenId === mapMenuId ? styles.cardMenuOpen : ""}`}
                  onClick={() => navigate(RoutePaths.learningMapOf(map.id))}
                >
                  <div className={styles.cardTop}>
                    <span className={styles.mapBadge}>学习地图</span>
                    <div className={styles.menuWrap}>
                      <button
                        type="button"
                        className={styles.sourceBtn}
                        title="更多操作"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId((prev) =>
                            prev === mapMenuId ? null : mapMenuId,
                          );
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <circle cx="12" cy="5" r="2" />
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="12" cy="19" r="2" />
                        </svg>
                      </button>
                      {menuOpenId === mapMenuId && (
                        <div
                          className={styles.menuPanel}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className={styles.menuItem}
                            onClick={() =>
                              navigate(RoutePaths.learningMapOf(map.id))
                            }
                          >
                            查看地图
                          </button>
                          <button
                            type="button"
                            className={`${styles.menuItem} ${styles.menuDanger}`}
                            onClick={() =>
                              handleDeleteMap(
                                map.id,
                                map.title || map.goal || "未命名学习地图",
                              )
                            }
                          >
                            删除地图
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <h3 className={styles.cardTitle}>{map.title || map.goal}</h3>
                  <p className={styles.cardIntent}>{map.goal}</p>
                  <div className={styles.cardMetaStack}>
                    <span className={styles.cardMetaLine}>
                      最近更新 {formatDateTime(map.updatedAt)}
                    </span>
                    <span className={styles.cardMetaLine}>
                      生成于 {formatDateTime(map.createdAt)}
                    </span>
                    <span className={styles.cardMetaLine}>
                      持续 {formatElapsedSpan(map.createdAt, map.updatedAt)}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : (
        /* ── 数据报告 Tab ── */
        <div className={styles.reportSection}>
          <div className={styles.reportBlock}>
            <h3 className={styles.reportTitle}>学习进度</h3>
            {sessions.length === 0 ? (
              <p className={styles.reportEmpty}>暂无数据</p>
            ) : (
              <div className={styles.progressList}>
                {sessions
                  .filter((s) => s.status === "active" || s.status === "paused")
                  .map((s) => (
                    <div key={s.id} className={styles.progressItem}>
                      <div className={styles.progressItemTop}>
                        <span className={styles.progressItemTitle}>
                          {getSessionDisplayTitle(s)}
                        </span>
                        <span className={styles.progressItemPct}>
                          {s.progress}%
                        </span>
                      </div>
                      <div className={styles.progressItemSubtitle}>
                        {getSessionDisplaySubtitle(s)}
                      </div>
                      <div className={styles.progressItemBar}>
                        <div
                          className={styles.progressItemFill}
                          style={{ width: `${s.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className={styles.adviceCard}>
            <div className={styles.adviceIcon}>
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
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
            <div className={styles.adviceText}>
              {totalSessions === 0
                ? "欢迎使用 EduFlow AI！去主页创建你的第一个学习会话，开始智能学习之旅。"
                : completedSessions === 0
                  ? "你已经开始了学习之旅！坚持完成至少一个知识蓝图，掌握度会显著提升。"
                  : `太棒了！你已经完成了 ${completedSessions} 个学习计划。保持节奏，尝试挑战新的语言或更高难度的知识点。`}
            </div>
          </div>
        </div>
      )}

      {/* 参考资源弹窗 */}
      {sourcesPopup && (
        <div
          className={styles.modalOverlay}
          onClick={() => setSourcesPopup(null)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                参考资源 — {sourcesPopup.title}
              </h3>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setSourcesPopup(null)}
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
              {sourcesLoading ? (
                <p className={styles.modalEmpty}>正在加载参考资源…</p>
              ) : sourcesPopup.sources.length === 0 ? (
                <p className={styles.modalEmpty}>该科目没有记录参考资源</p>
              ) : (
                <ul className={styles.sourceList}>
                  {sourcesPopup.sources.map((src, i) => (
                    <li key={i} className={styles.sourceItem}>
                      {src.type && (
                        <span className={styles.sourceType}>
                          {SOURCE_TYPE_LABEL[src.type] || "资源"}
                        </span>
                      )}
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.sourceLink}
                      >
                        {src.title || src.url}
                      </a>
                      {(src.description || src.snippet) && (
                        <p className={styles.sourceSnippet}>
                          {src.description || src.snippet}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {renamingSession && (
        <div
          className={styles.modalOverlay}
          onClick={() => setRenamingSession(null)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>编辑会话名称</h3>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setRenamingSession(null)}
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
              <label
                className={styles.formLabel}
                htmlFor="rename-session-title"
              >
                会话名称
              </label>
              <input
                id="rename-session-title"
                className={styles.formInput}
                value={renameTitle}
                onChange={(e) => setRenameTitle(e.target.value)}
                maxLength={120}
                placeholder="输入新的会话名称"
              />
              {renameError && <p className={styles.formError}>{renameError}</p>}
              <div className={styles.modalActions}>
                <Button
                  variant="secondary"
                  onClick={() => setRenamingSession(null)}
                >
                  取消
                </Button>
                <Button
                  onClick={handleRenameSubmit}
                  loading={updateSession.isPending}
                >
                  保存名称
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {detailPopup && (
        <div
          className={styles.modalOverlay}
          onClick={() => setDetailPopup(null)}
        >
          <div
            className={`${styles.modal} ${styles.detailModal}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                会话详情 — {getSessionDisplayTitle(detailPopup.session)}
              </h3>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setDetailPopup(null)}
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
              {detailLoading ? (
                <p className={styles.modalEmpty}>正在整理会话详情…</p>
              ) : detailPopup.error ||
                !detailPopup.blueprint ||
                !detailSummary ? (
                <p className={styles.modalEmpty}>
                  {detailPopup.error || "暂时无法获取该会话的详细信息"}
                </p>
              ) : (
                <div className={styles.detailBody}>
                  <div className={styles.detailHero}>
                    <div>
                      <div className={styles.detailMetaRow}>
                        <span className={styles.detailMetaText}>
                          {statusLabel(detailPopup.session.status)} ·{" "}
                          {detailPopup.session.progress}%
                        </span>
                        <span className={styles.detailMetaText}>
                          {formatDateRange(
                            detailPopup.session.createdAt,
                            detailPopup.session.status === "completed"
                              ? detailPopup.session.updatedAt
                              : null,
                          )}
                        </span>
                        <span className={styles.detailMetaText}>
                          {`持续 ${formatElapsedSpan(
                            detailPopup.session.createdAt,
                            detailPopup.session.status === "completed"
                              ? detailPopup.session.updatedAt
                              : null,
                          )}`}
                        </span>
                      </div>
                      <p className={styles.detailSummary}>
                        {detailSummary.summary}
                      </p>
                    </div>
                    <div className={styles.detailVersionCard}>
                      <span className={styles.detailVersionLabel}>
                        知识版本
                      </span>
                      <strong className={styles.detailVersionValue}>
                        {detailSummary.version}
                      </strong>
                      <span className={styles.detailVersionStatus}>
                        是否最新：{detailSummary.latestStatus}
                      </span>
                    </div>
                  </div>

                  <div className={styles.detailGrid}>
                    <section className={styles.detailSection}>
                      <h4 className={styles.detailSectionTitle}>学习目标</h4>
                      <p className={styles.detailParagraph}>
                        {getSessionDisplaySubtitle(detailPopup.session) ||
                          detailPopup.session.intent}
                      </p>
                    </section>

                    <section className={styles.detailSection}>
                      <h4 className={styles.detailSectionTitle}>
                        包含哪些知识
                      </h4>
                      <div className={styles.detailTagWrap}>
                        {detailSummary.modules.map((item) => (
                          <span key={item} className={styles.detailTag}>
                            {item}
                          </span>
                        ))}
                      </div>
                      <ul className={styles.detailList}>
                        {detailSummary.knowledge.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>

                    <section className={styles.detailSection}>
                      <h4 className={styles.detailSectionTitle}>
                        这门科目能做什么
                      </h4>
                      <ul className={styles.detailList}>
                        {detailSummary.useCases.map((item, index) => (
                          <li key={`${item}-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </section>

                    <section className={styles.detailSection}>
                      <h4 className={styles.detailSectionTitle}>
                        版本与参考依据
                      </h4>
                      <p className={styles.detailParagraph}>
                        {detailSummary.versionNote}
                      </p>
                      {detailSummary.officialDocs && (
                        <a
                          href={detailSummary.officialDocs}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.detailLink}
                        >
                          查看官方文档
                        </a>
                      )}
                      <p className={styles.detailMetaText}>
                        本会话共参考 {detailSummary.sourceCount} 条权威资源。
                      </p>
                    </section>
                  </div>

                  <div className={styles.modalActions}>
                    <Button
                      variant="secondary"
                      onClick={() => handleShowSources(detailPopup.session)}
                    >
                      查看参考资源
                    </Button>
                    <Button
                      onClick={() =>
                        navigate(RoutePaths.workbenchOf(detailPopup.session.id))
                      }
                    >
                      继续学习
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyStatsPage;
