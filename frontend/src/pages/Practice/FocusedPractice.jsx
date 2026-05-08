/**
 * 专项练习 — 选择学习科目后进入 workbench 式答题页面
 *
 * 第一步：选择学习科目
 * 第二步：进入三栏布局 — 左侧模块/原子知识点导航、中部答题区、右侧统计
 *         点击章节模块 → 展开原子知识点（带平滑下滑动画）
 *         点击原子知识点 → AI 针对该知识点出 5 题左右
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useSubjects,
  useGenerateAtomicPractice,
} from "../../hooks/usePractice.js";
import {
  getSessionDisplaySubtitle,
  getSessionDisplayTitle,
} from "../../utils/sessionDisplay.js";
import PracticeExam from "./PracticeExam.jsx";
import styles from "./PracticePage.module.css";
import wbStyles from "./FocusedWorkbench.module.css";

/** 把蓝图树折叠为「章节模块 → 原子（叶子）知识点」两层结构 */
const buildTwoLevelTree = (subject) => {
  if (!subject?.blueprintTree?.children?.length) return [];

  const collectLeaves = (node, out) => {
    if (!node) return;
    const children = node.children ?? [];
    if (children.length === 0) {
      out.push({ id: node.id, name: node.name });
      return;
    }
    children.forEach((c) => collectLeaves(c, out));
  };

  return subject.blueprintTree.children.map((mod) => {
    const leaves = [];
    collectLeaves(mod, leaves);
    return { id: mod.id, name: mod.name, leaves };
  });
};

const FocusedPractice = () => {
  const navigate = useNavigate();
  const { subjects, isLoading } = useSubjects();
  const generateAtomic = useGenerateAtomicPractice();

  const [selectedSubject, setSelectedSubject] = useState(null);
  const [entered, setEntered] = useState(false);
  const [expandedModules, setExpandedModules] = useState(new Set());
  const [activeAtomicId, setActiveAtomicId] = useState(null);
  const [examData, setExamData] = useState(null);
  const [examHistory, setExamHistory] = useState([]);

  const currentSubject = subjects.find((s) => s.sessionId === selectedSubject);
  const modules = currentSubject ? buildTwoLevelTree(currentSubject) : [];

  const handleEnter = () => {
    if (!currentSubject) return;
    setEntered(true);
    // 默认展开第一个模块
    if (modules.length > 0) {
      setExpandedModules(new Set([modules[0].id]));
    }
  };

  const toggleModule = (modId) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(modId)) next.delete(modId);
      else next.add(modId);
      return next;
    });
  };

  const handleAtomicClick = async (modId, leaf) => {
    if (!currentSubject) return;
    setActiveAtomicId(leaf.id);
    setExamData(null);
    try {
      const result = await generateAtomic.mutateAsync({
        sessionId: currentSubject.sessionId,
        atomicNodeId: leaf.id,
      });
      setExamData({
        problems: result.problems ?? [],
        practiceSessionId: result.practiceSessionId,
        language: currentSubject.language,
        atomicName: leaf.name,
      });
    } catch {
      /* error handled via mutation state */
    }
  };

  const handleExamFinish = () => {
    if (examData) {
      setExamHistory((prev) => [
        ...prev,
        {
          atomic: examData.atomicName,
          problems: examData.problems.length,
        },
      ]);
    }
    setExamData(null);
  };

  // ── 科目选择页 ──
  if (!entered) {
    return (
      <div className={styles.page}>
        <div className={wbStyles.backRow}>
          <button
            type="button"
            className={wbStyles.backBtn}
            onClick={() => navigate("/practice")}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            返回
          </button>
        </div>

        <header className={styles.header}>
          <h1 className={styles.title}>专项练习</h1>
          <p className={styles.subtitle}>
            选择学习科目 → 展开章节 → 点击原子知识点，AI 针对该知识点精准出题。
          </p>
        </header>

        <div className={wbStyles.section}>
          <div className={wbStyles.sectionTitleRow}>
            <span className={wbStyles.sectionTitle}>选择学习科目</span>
          </div>
          {isLoading ? (
            <div className={wbStyles.empty}>加载中…</div>
          ) : subjects.length === 0 ? (
            <div className={wbStyles.empty}>
              还没有学习记录，先从主页创建学习会话吧
            </div>
          ) : (
            <div className={wbStyles.subjectList}>
              {subjects.map((s) => (
                <button
                  key={s.sessionId}
                  type="button"
                  className={`${wbStyles.subjectChip} ${selectedSubject === s.sessionId ? wbStyles.subjectActive : ""}`}
                  onClick={() => setSelectedSubject(s.sessionId)}
                >
                  <span className={wbStyles.subjectCopy}>
                    <span className={wbStyles.subjectName}>
                      {getSessionDisplayTitle(s)}
                    </span>
                    <span className={wbStyles.subjectSubtitle}>
                      {getSessionDisplaySubtitle(s)}
                    </span>
                  </span>
                  <span className={wbStyles.subjectPct}>{s.progress}%</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className={wbStyles.enterBtn}
          disabled={!currentSubject}
          onClick={handleEnter}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          进入专项练习
        </button>
      </div>
    );
  }

  // ── Workbench 式答题页面 ──
  return (
    <div className={wbStyles.wb}>
      <header className={wbStyles.header}>
        <button
          type="button"
          className={wbStyles.backBtn}
          onClick={() => {
            setEntered(false);
            setExamData(null);
            setActiveAtomicId(null);
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 13 13"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M8 2L4 6.5 8 11" />
          </svg>
        </button>
        <span className={wbStyles.headerTitle}>
          专项练习 — {currentSubject?.language}
        </span>
        <span className={wbStyles.headerSub}>{currentSubject?.title}</span>
        <div className={wbStyles.headerSpacer} />
        <span className={wbStyles.headerBadge}>
          已完成 {examHistory.length} 组
        </span>
      </header>

      <div className={wbStyles.body}>
        {/* 左侧导航：章节 + 原子知识点 */}
        <aside className={wbStyles.sidebar}>
          <div className={wbStyles.sidebarTitle}>知识模块</div>
          <nav className={wbStyles.moduleList}>
            {modules.map((mod) => {
              const expanded = expandedModules.has(mod.id);
              return (
                <div key={mod.id} className={wbStyles.moduleBlock}>
                  <button
                    type="button"
                    className={`${wbStyles.moduleItem} ${expanded ? wbStyles.moduleActive : ""}`}
                    onClick={() => toggleModule(mod.id)}
                    aria-expanded={expanded}
                  >
                    <span
                      className={`${wbStyles.moduleChevron} ${expanded ? wbStyles.moduleChevronOpen : ""}`}
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      >
                        <polyline points="9 6 15 12 9 18" />
                      </svg>
                    </span>
                    <span className={wbStyles.moduleName}>{mod.name}</span>
                    <span className={wbStyles.moduleCount}>
                      {mod.leaves.length}
                    </span>
                  </button>

                  <div
                    className={`${wbStyles.subList} ${expanded ? wbStyles.subListOpen : ""}`}
                  >
                    <div className={wbStyles.subListInner}>
                      {mod.leaves.length === 0 ? (
                        <div className={wbStyles.subEmpty}>暂无知识点</div>
                      ) : (
                        mod.leaves.map((leaf) => (
                          <button
                            key={leaf.id}
                            type="button"
                            className={`${wbStyles.subItem} ${activeAtomicId === leaf.id ? wbStyles.subItemActive : ""}`}
                            onClick={() => handleAtomicClick(mod.id, leaf)}
                            disabled={generateAtomic.isPending}
                          >
                            <span
                              className={`${wbStyles.subDot} ${activeAtomicId === leaf.id ? wbStyles.subDotActive : ""}`}
                            />
                            <span className={wbStyles.subName}>
                              {leaf.name}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* 中部答题区 */}
        <main className={wbStyles.main}>
          {generateAtomic.isPending ? (
            <div className={wbStyles.loadingArea}>
              <div className={wbStyles.loadingIcon}>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <div className={wbStyles.loadingText}>
                AI 正在为该原子知识点生成专项题…
              </div>
            </div>
          ) : examData?.problems?.length > 0 ? (
            <PracticeExam
              problems={examData.problems}
              practiceSessionId={examData.practiceSessionId}
              language={examData.language}
              allowUpload={false}
              onFinish={handleExamFinish}
            />
          ) : (
            <div className={wbStyles.emptyMain}>
              <div className={wbStyles.emptyIcon}>
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="6" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
              </div>
              <h3 className={wbStyles.emptyTitle}>
                选择左侧的原子知识点开始练习
              </h3>
              <p className={wbStyles.emptyDesc}>
                展开章节后，点击具体的原子知识点。AI 会针对该知识点精准出题，
                难度由 AI 自动评定。前几个原子知识点已预生成好，秒开！
              </p>
            </div>
          )}
        </main>

        {/* 右侧统计 */}
        <aside className={wbStyles.statsPanel}>
          <div className={wbStyles.statsPanelTitle}>练习统计</div>
          <div className={wbStyles.statsItem}>
            <span className={wbStyles.statsLabel}>已练知识点</span>
            <span className={wbStyles.statsValue}>{examHistory.length}</span>
          </div>
          <div className={wbStyles.statsItem}>
            <span className={wbStyles.statsLabel}>总题数</span>
            <span className={wbStyles.statsValue}>
              {examHistory.reduce((sum, h) => sum + h.problems, 0)}
            </span>
          </div>

          {examHistory.length > 0 && (
            <>
              <div className={wbStyles.statsDivider} />
              <div className={wbStyles.statsPanelTitle}>练习记录</div>
              {examHistory.map((h, i) => (
                <div key={i} className={wbStyles.historyItem}>
                  <span className={wbStyles.historyDot} />
                  <span className={wbStyles.historyName}>{h.atomic}</span>
                  <span className={wbStyles.historyCount}>{h.problems} 题</span>
                </div>
              ))}
            </>
          )}
        </aside>
      </div>
    </div>
  );
};

export default FocusedPractice;
