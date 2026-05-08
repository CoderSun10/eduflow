/**
 * 例题训练 — 主页（Hub）
 *
 * 展示三种练习模式入口 + 练习数据概览 + 最近练习记录
 */
import { useNavigate } from "react-router-dom";
import {
  usePracticeStats,
  useRecentPracticeActivities,
} from "../../hooks/usePractice.js";
import { RoutePaths } from "../../constants/routes.js";
import styles from "./PracticePage.module.css";

const MODE_LABEL = {
  focused: "专项练习",
  comprehensive: "综合练习",
  project: "项目挑战",
  wrong_notes: "错题集",
};

const getActivityPath = (activity) =>
  activity.kind === "wrong_note_retry"
    ? RoutePaths.PRACTICE_WRONG_NOTES
    : RoutePaths.practiceHistoryOf(activity.practiceSessionId || activity.id);

const PracticePage = () => {
  const navigate = useNavigate();
  const { stats } = usePracticeStats();
  const { recentActivities } = useRecentPracticeActivities();

  const recentHistory = (recentActivities ?? []).slice(0, 8);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>例题训练</h1>
        <p className={styles.subtitle}>
          基于你的学习进度，AI 自动生成针对性练习题
        </p>
      </header>

      {/* ── 数据概览 ── */}
      {stats && (
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <span className={styles.statNum}>{stats.totalSessions}</span>
            <span className={styles.statLabel}>练习次数</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNum}>{stats.totalAnswered}</span>
            <span className={styles.statLabel}>作答题数</span>
          </div>
          <div className={styles.statCard}>
            <span className={`${styles.statNum} ${styles.correctColor}`}>
              {stats.totalCorrect}
            </span>
            <span className={styles.statLabel}>答对</span>
          </div>
          <button
            type="button"
            className={styles.statCard}
            onClick={() => navigate(RoutePaths.PRACTICE_WRONG_NOTES)}
          >
            <span className={`${styles.statNum} ${styles.wrongColor}`}>
              {stats.totalWrong}
            </span>
            <span className={styles.statLabel}>答错</span>
          </button>
          <div className={styles.statCard}>
            <span className={styles.statNum}>{stats.accuracy}%</span>
            <span className={styles.statLabel}>正确率</span>
          </div>
        </div>
      )}

      {/* ── 模式入口 ── */}
      <div className={styles.modeGrid}>
        <button
          type="button"
          className={styles.modeCard}
          onClick={() => navigate("/practice/focused")}
        >
          <div className={`${styles.modeIcon} ${styles.iconFocused}`}>
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
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
          </div>
          <div className={styles.modeBody}>
            <div className={styles.modeLabel}>专项练习</div>
            <div className={styles.modeDesc}>
              选择特定知识点，深入训练。混合选择题、填空题和代码实操题。
            </div>
          </div>
          <svg
            className={styles.modeArrow}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <button
          type="button"
          className={styles.modeCard}
          onClick={() => navigate("/practice/comprehensive")}
        >
          <div className={`${styles.modeIcon} ${styles.iconComprehensive}`}>
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
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          </div>
          <div className={styles.modeBody}>
            <div className={styles.modeLabel}>综合练习</div>
            <div className={styles.modeDesc}>
              选择学习科目，AI 根据进度自动组合知识点出题。
            </div>
          </div>
          <svg
            className={styles.modeArrow}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <button
          type="button"
          className={styles.modeCard}
          onClick={() => navigate("/practice/project")}
        >
          <div className={`${styles.modeIcon} ${styles.iconProject}`}>
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
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
              <line x1="12" y1="22" x2="12" y2="15.5" />
              <polyline points="22 8.5 12 15.5 2 8.5" />
            </svg>
          </div>
          <div className={styles.modeBody}>
            <div className={styles.modeLabel}>项目挑战</div>
            <div className={styles.modeDesc}>
              多科目综合实战，AI 生成一道高质量代码项目题。
            </div>
          </div>
          <svg
            className={styles.modeArrow}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <button
          type="button"
          className={styles.modeCard}
          onClick={() => navigate(RoutePaths.PRACTICE_WRONG_NOTES)}
        >
          <div className={`${styles.modeIcon} ${styles.iconWrongNotes}`}>
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
              <path d="M9 3h6l4 4v14H5V3h4z" />
              <path d="M9 3v5h6" />
              <path d="M9 13h6" />
              <path d="M9 17h4" />
            </svg>
          </div>
          <div className={styles.modeBody}>
            <div className={styles.modeLabel}>错题集</div>
            <div className={styles.modeDesc}>
              长期保留所有答错过的题，支持随时回看、重做，并再次交给 AI 评估。
            </div>
          </div>
          <svg
            className={styles.modeArrow}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* ── 最近练习 ── */}
      {recentHistory.length > 0 && (
        <section className={styles.recentSection}>
          <h2 className={styles.sectionTitle}>最近练习</h2>
          <div className={styles.historyList}>
            {recentHistory.map((h) => (
              <button
                key={h.id}
                type="button"
                className={styles.historyCard}
                onClick={() => navigate(getActivityPath(h))}
              >
                <div className={styles.historyTop}>
                  <span className={styles.historyMode}>
                    {MODE_LABEL[h.mode] || h.mode}
                  </span>
                  <span className={styles.historyLang}>{h.language}</span>
                  <span className={styles.historyDate}>
                    {new Date(h.createdAt).toLocaleString()}
                  </span>
                </div>
                {h.title ? (
                  <div className={styles.historyTitle}>{h.title}</div>
                ) : null}
                <div className={styles.historyBottom}>
                  <span className={styles.historyScore}>
                    {h.kind === "wrong_note_retry"
                      ? h.correctCount > 0
                        ? "错题重做已通过"
                        : "错题重做仍有问题"
                      : `${h.correctCount}/${h.answeredCount || h.totalCount} 正确`}
                  </span>
                  <div className={styles.historyBar}>
                    <div
                      className={styles.historyFill}
                      style={{
                        width:
                          (h.answeredCount || h.totalCount) > 0
                            ? `${(h.correctCount / (h.answeredCount || h.totalCount)) * 100}%`
                            : "0%",
                      }}
                    />
                  </div>
                </div>
                <div className={styles.historyMetaText}>
                  {h.kind === "wrong_note_retry"
                    ? "来自错题集的重新作答"
                    : `本次已作答 ${h.answeredCount || 0} 题，共 ${h.totalCount || 0} 题`}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default PracticePage;
