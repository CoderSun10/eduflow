/**
 * 主页：意图输入
 *
 * "生成知识蓝图"按钮：
 *   1. POST /sessions 立即创建会话（不等蓝图生成）
 *   2. 轮询 /sessions/:id/generation-progress 实时刷新真实进度
 *   3. 蓝图 done 后跳转 Workbench
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";
import { useSpeechRecognition } from "../../hooks/useSpeechRecognition.js";
import { useCreateSession, useSessions } from "../../hooks/useSession.js";
import { useLearningMaps } from "../../hooks/useLearningMap.js";
import { formatRelativeTime, greetingOf } from "../../utils/format.js";
import { RoutePaths } from "../../constants/routes.js";
import { useUiStore } from "../../store/uiStore.js";
import {
  getSessionDisplaySubtitle,
  getSessionDisplayTitle,
} from "../../utils/sessionDisplay.js";
import styles from "./HomePage.module.css";

const intentHints = [
  { label: "C语言 · 零基础", language: "C" },
  { label: "React Hooks", language: "React" },
  { label: "Python 爬虫", language: "Python" },
  { label: "Rust 入门", language: "Rust" },
];

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

const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const createSession = useCreateSession();
  const { sessions } = useSessions();
  const { learningMaps } = useLearningMaps();
  const startGenerationTask = useUiStore((s) => s.startGenerationTask);
  const failGenerationTask = useUiStore((s) => s.failGenerationTask);

  const [intent, setIntent] = useState("");
  const [creating, setCreating] = useState(false);

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
          setIntent((prev) => (prev ? `${prev} ${text}` : text));
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

  const parseIntent = (text) => {
    const trimmed = text.trim();
    const match = intentHints.find((h) => trimmed === h.label);
    if (match) {
      return { language: match.language, title: match.language };
    }
    const langs = [
      "C++",
      "C#",
      "Objective-C",
      "JavaScript",
      "TypeScript",
      "Python",
      "Java",
      "Kotlin",
      "Swift",
      "Go",
      "Rust",
      "Ruby",
      "PHP",
      "Perl",
      "Scala",
      "Haskell",
      "Erlang",
      "Elixir",
      "Clojure",
      "Dart",
      "Lua",
      "R",
      "MATLAB",
      "Julia",
      "Shell",
      "Bash",
      "PowerShell",
      "SQL",
      "PostgreSQL",
      "MySQL",
      "MongoDB",
      "HTML",
      "CSS",
      "Sass",
      "Less",
      "React",
      "Vue",
      "Angular",
      "Svelte",
      "Next.js",
      "Nuxt",
      "Node.js",
      "Express",
      "Django",
      "Flask",
      "Spring",
      "Laravel",
      "Flutter",
      "React Native",
      "Docker",
      "Kubernetes",
      "Terraform",
      "Git",
      "Linux",
      "C",
    ];
    const lower = trimmed.toLowerCase();
    const found = langs.find((l) => lower.includes(l.toLowerCase()));
    const language = found ?? trimmed.split(/[\s，,]+/)[0].slice(0, 20);
    return {
      language,
      title: language || trimmed.slice(0, 20) || "学习计划",
    };
  };

  const submit = async () => {
    if (!intent.trim() || creating) return;
    setCreating(true);
    try {
      const { language, title } = parseIntent(intent);
      const result = await createSession.mutateAsync({
        title,
        language,
        intent: intent.trim(),
      });
      startGenerationTask({
        kind: "session",
        sessionId: result.session.id,
        title: `正在为「${language}」生成知识蓝图`,
        subjectName: language,
        message: "正在解析你提供的意图…",
        progress: 5,
        actionLabel: "查看详情",
        actionTo: RoutePaths.workbenchOf(result.session.id),
      });
      setIntent("");
    } catch (err) {
      console.error("[home] 创建会话失败", err);
      failGenerationTask({
        title: "知识蓝图创建失败",
        message: err.message ?? "请稍后重试。",
      });
    } finally {
      setCreating(false);
    }
  };

  const activeSessions = sessions.filter(
    (session) => session.status === "active" || session.status === "paused",
  );
  const recentMaps = learningMaps.slice(0, 3);
  const overviewCards = [
    {
      label: "学习会话",
      value: sessions.length,
      helper: `进行中 ${activeSessions.length} 个`,
    },
    {
      label: "学习地图",
      value: learningMaps.length,
      helper: recentMaps[0] ? "支持持久化回看" : "生成后自动保存",
    },
    {
      label: "练习入口",
      value: "3",
      helper: "专项 / 综合 / 项目挑战",
    },
  ];

  return (
    <div className={styles.main}>
      <header className={styles.topBar}>
        <div>
          <h1 className={styles.greeting}>
            {greetingOf()}，<span>{user?.username ?? "同学"}</span>
          </h1>
          <p className={styles.greetingSub}>
            今天继续把学习目标转成清晰路线，并推进你的知识蓝图与练习计划。
          </p>
        </div>
        <div className={styles.badges}>
          <span className={styles.badge}>
            <span className={styles.dot} />
            AI 服务正常
          </span>
          <span className={styles.badge}>已保存地图 {learningMaps.length}</span>
        </div>
      </header>

      <section className={styles.heroGrid}>
        <section className={styles.intentBox}>
          <div className={styles.intentLabel}>// 开始新的学习</div>
          <div className={styles.intentHeadline}>构建你的知识蓝图</div>
          <div className={styles.intentInputWrap}>
            <textarea
              className={styles.intentInput}
              placeholder={
                isRecording
                  ? "正在录音..."
                  : "直接描述你的学习目标，例如：\n「Rust 入门，已有 C++ 基础，想做一个命令行工具」\n你也可以贴上参考网址、课程名或电子书名，AI 会优先使用你提供的资源"
              }
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              disabled={isRecording || isProcessing}
            />
          </div>
          {speechError && (
            <div className={styles.speechError}>{speechError}</div>
          )}
          <div className={styles.intentActions}>
            <div className={styles.hints}>
              {intentHints.map((h) => (
                <button
                  key={h.label}
                  type="button"
                  className={styles.hintChip}
                  onClick={() => setIntent(h.label)}
                >
                  {h.label}
                </button>
              ))}
            </div>
            <div className={styles.intentActionButtons}>
              <button
                type="button"
                className={`${styles.voiceAction} ${isRecording ? styles.recording : ""} ${isProcessing ? styles.processing : ""}`}
                onClick={handleVoiceClick}
                disabled={creating || isProcessing}
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
              <button
                type="button"
                className={`${styles.generateAction} ${creating ? styles.generateActionLoading : ""}`}
                onClick={submit}
                disabled={creating}
              >
                {creating ? (
                  <span className={styles.generateSpinner} aria-hidden="true" />
                ) : null}
                <span className={styles.generateActionText}>
                  {creating ? "AI 正在生成蓝图…" : "生成知识蓝图"}
                </span>
                <svg
                  className={styles.generateActionIcon}
                  viewBox="0 0 13 13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <path d="M2 6.5h9M7 2l4.5 4.5L7 11" />
                </svg>
              </button>
            </div>
          </div>
        </section>

        <aside className={styles.heroSide}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>学习地图工作台</div>
            <div className={styles.summaryTitle}>
              结构化保存你的长期学习路线
            </div>
            <p className={styles.summaryText}>
              学习地图现在分为“创建入口”和“地图管理”两部分：创建仍在学习地图页，已保存地图统一在学习统计里管理。
            </p>
            <div className={styles.summaryActions}>
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={() => navigate(RoutePaths.LEARNING_MAP)}
              >
                进入学习地图
              </button>
              <button
                type="button"
                className={styles.ghostAction}
                onClick={() => navigate(`${RoutePaths.STATS}?tab=maps`)}
              >
                地图管理
              </button>
            </div>
          </div>
          <div className={styles.quickNavCard}>
            <button
              type="button"
              className={styles.quickNavItem}
              onClick={() => navigate(RoutePaths.PRACTICE)}
            >
              <span className={styles.quickNavTitle}>去练习</span>
              <span className={styles.quickNavText}>
                根据蓝图进度进入专项、综合或项目挑战。
              </span>
            </button>
            <button
              type="button"
              className={styles.quickNavItem}
              onClick={() => navigate(RoutePaths.STATS)}
            >
              <span className={styles.quickNavTitle}>管理会话</span>
              <span className={styles.quickNavText}>
                重命名、查看详情、参考资源与整体学习进展。
              </span>
            </button>
          </div>
        </aside>
      </section>

      <section className={styles.overviewGrid}>
        {overviewCards.map((card) => (
          <article key={card.label} className={styles.overviewCard}>
            <span className={styles.overviewLabel}>{card.label}</span>
            <strong className={styles.overviewValue}>{card.value}</strong>
            <span className={styles.overviewHelper}>{card.helper}</span>
          </article>
        ))}
      </section>

      <section className={styles.dashboardGrid}>
        <section className={styles.panelCard}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>进行中的学习</h2>
              <p className={styles.panelSubtitle}>
                继续推进你当前最重要的学习会话。
              </p>
            </div>
          </div>
          <div className={styles.panelBody}>
            {activeSessions.length === 0 ? (
              <div className={styles.emptyState}>
                你还没有进行中的学习会话，先从上方创建一条新的知识蓝图。
              </div>
            ) : (
              <div className={styles.activeList}>
                {activeSessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    className={styles.activeCard}
                    onClick={() => navigate(RoutePaths.workbenchOf(session.id))}
                  >
                    <div className={styles.activeTop}>
                      <span className={styles.activePct}>
                        {session.progress}%
                      </span>
                    </div>
                    <div className={styles.activeTitle}>
                      {getSessionDisplayTitle(session)}
                    </div>
                    <div className={styles.activeSubtitle}>
                      {getSessionDisplaySubtitle(session)}
                    </div>
                    <div className={styles.activeMeta}>
                      {formatRelativeTime(session.updatedAt)}
                    </div>
                    <div className={styles.activeBar}>
                      <div
                        className={styles.activeBarFill}
                        style={{ width: `${session.progress}%` }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className={styles.panelCard}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>最近保存的学习地图</h2>
              <p className={styles.panelSubtitle}>
                回到你之前规划过的长期路线继续查看。
              </p>
            </div>
            <button
              type="button"
              className={styles.inlineLink}
              onClick={() => navigate(`${RoutePaths.STATS}?tab=maps`)}
            >
              查看全部
            </button>
          </div>
          <div className={styles.panelBody}>
            {learningMaps.length === 0 ? (
              <div className={styles.emptyState}>
                还没有保存的学习地图，去学习地图页生成第一张长期路线图。
              </div>
            ) : (
              <div className={styles.mapPreviewList}>
                {learningMaps.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={styles.mapPreviewCard}
                    onClick={() => navigate(RoutePaths.learningMapOf(item.id))}
                  >
                    <div className={styles.mapPreviewTop}>
                      <span className={styles.mapPreviewBadge}>学习地图</span>
                      <span className={styles.mapPreviewDate}>
                        {formatRelativeTime(item.updatedAt)}
                      </span>
                    </div>
                    <div className={styles.mapPreviewTitle}>
                      {item.title || item.goal}
                    </div>
                    <div className={styles.mapPreviewGoal}>{item.goal}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </section>
    </div>
  );
};

export default HomePage;
