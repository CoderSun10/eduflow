import { useNavigate } from "react-router-dom";
import { useUiStore } from "../../store/uiStore.js";
import styles from "./AIGenerationOverlay.module.css";

const formatRemaining = (ms) => {
  if (typeof ms !== "number" || ms <= 0) return null;
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds} 秒`;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainMinutes = minutes % 60;
    return remainMinutes > 0
      ? `${hours} 小时 ${remainMinutes} 分`
      : `${hours} 小时`;
  }
  return seconds > 0 ? `${minutes} 分 ${seconds} 秒` : `${minutes} 分`;
};

const OrbitAnimation = () => (
  <div className={styles.orbitWrap} aria-hidden="true">
    <div className={styles.orbitRing1}>
      <span className={styles.orbitDot} />
    </div>
    <div className={styles.orbitRing2}>
      <span className={styles.orbitDot} />
    </div>
    <div className={styles.orbitRing3}>
      <span className={styles.orbitDot} />
    </div>
    <div className={styles.coreCircle}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    </div>
  </div>
);

const AIGenerationOverlay = () => {
  const navigate = useNavigate();
  const tasks = useUiStore((s) => s.generationTasks);
  const fullscreen = useUiStore((s) => s.generationFullscreen);
  const setGenerationFullscreen = useUiStore((s) => s.setGenerationFullscreen);
  const dismissGenerationTask = useUiStore((s) => s.dismissGenerationTask);

  const runningTasks = tasks.filter((t) => t.status === "running");
  const errorTasks = tasks.filter((t) => t.status === "error");
  const primaryTask = runningTasks[0] ?? errorTasks[0] ?? tasks[0] ?? null;

  if (!fullscreen || !primaryTask) return null;

  const isError = primaryTask.status === "error";
  const isSuccess = primaryTask.status === "success";
  const progress =
    typeof primaryTask.progress === "number" ? primaryTask.progress : null;
  const eta = primaryTask.estimatedRemainingMs
    ? formatRemaining(primaryTask.estimatedRemainingMs)
    : null;

  const handleCollapse = () => {
    setGenerationFullscreen(false);
  };

  const handleAction = () => {
    if (primaryTask.actionTo) {
      navigate(primaryTask.actionTo);
    }
    setGenerationFullscreen(false);
    if (primaryTask.status !== "running") {
      dismissGenerationTask(primaryTask.id);
    }
  };

  return (
    <div className={`${styles.overlay} ${isError ? styles.overlayError : ""}`}>
      <div className={styles.card}>
        {!isError && !isSuccess && <OrbitAnimation />}

        {isError && (
          <div className={styles.errorIcon} aria-hidden="true">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
        )}

        <div className={styles.textBlock}>
          <div className={`${styles.label} ${isError ? styles.labelError : ""}`}>
            {isError ? "AI 生成失败" : "AI 正在生成"}
          </div>
          <div className={styles.title}>{primaryTask.title}</div>
          <div className={styles.message}>{primaryTask.message}</div>
        </div>

        {progress !== null && !isError && (
          <div className={styles.progressBlock}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${Math.max(4, Math.min(100, progress))}%`,
                }}
              />
            </div>
            <div className={styles.progressMeta}>
              <span className={styles.progressValue}>{Math.round(progress)}%</span>
              {eta && (
                <span className={styles.eta}>预计剩余 {eta}</span>
              )}
            </div>
          </div>
        )}

        {runningTasks.length > 1 && (
          <div className={styles.queueNote}>
            另有 {runningTasks.length - 1} 个任务在后台排队
          </div>
        )}

        <div className={styles.actions}>
          {isError && primaryTask.actionTo && (
            <button
              type="button"
              className={styles.actionBtn}
              onClick={handleAction}
            >
              {primaryTask.actionLabel || "查看详情"}
            </button>
          )}
          <button
            type="button"
            className={styles.collapseBtn}
            onClick={handleCollapse}
          >
            收起到顶部横幅
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIGenerationOverlay;
