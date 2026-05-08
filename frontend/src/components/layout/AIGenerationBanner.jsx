import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { sessionApi } from "../../api/sessionApi.js";
import { useUiStore } from "../../store/uiStore.js";
import styles from "./AIGenerationBanner.module.css";

const statusLabel = {
  running: "生成中",
  success: "已完成",
  error: "生成失败",
};

const formatRemaining = (ms) => {
  if (typeof ms !== "number" || ms <= 0) return null;
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `预计剩余 ${seconds} 秒`;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainMinutes = minutes % 60;
    return remainMinutes > 0
      ? `预计剩余 ${hours} 小时 ${remainMinutes} 分`
      : `预计剩余 ${hours} 小时`;
  }
  return seconds > 0
    ? `预计剩余 ${minutes} 分 ${seconds} 秒`
    : `预计剩余 ${minutes} 分`;
};

const cancelTask = async (task) => {
  if (task.status === "running" && task.sessionId) {
    try {
      await sessionApi.remove(task.sessionId);
    } catch {}
  }
};

const AIGenerationBanner = () => {
  const navigate = useNavigate();
  const tasks = useUiStore((s) => s.generationTasks);
  const expanded = useUiStore((s) => s.generationBannerExpanded);
  const dismissGenerationTask = useUiStore((s) => s.dismissGenerationTask);
  const setGenerationBannerExpanded = useUiStore(
    (s) => s.setGenerationBannerExpanded,
  );

  useEffect(() => {
    const timers = tasks
      .filter((task) => task.autoCloseAt)
      .map((task) => {
        const remain = Math.max(0, task.autoCloseAt - Date.now());
        return window.setTimeout(() => {
          dismissGenerationTask(task.id);
        }, remain);
      });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [dismissGenerationTask, tasks]);

  if (tasks.length === 0) return null;

  const runningTasks = tasks.filter((t) => t.status === "running");
  const primaryTask = runningTasks[0] ?? tasks[0];
  const isMulti = tasks.length > 1;

  const headerTitle = isMulti
    ? `正在进行 ${runningTasks.length} 个生成任务`
    : primaryTask.title || "AI 正在生成";

  const headerMessage = isMulti
    ? `共 ${tasks.length} 个任务 · 点击展开查看各项进度`
    : primaryTask.message;

  const handleAction = (task) => {
    if (task.actionTo) navigate(task.actionTo);
    if (task.status !== "running") dismissGenerationTask(task.id);
  };

  const handleCloseOne = async (task) => {
    await cancelTask(task);
    dismissGenerationTask(task.id);
  };

  const handleCloseAll = async () => {
    await Promise.allSettled(tasks.map(cancelTask));
    dismissGenerationTask(null);
  };

  return (
    <div className={`${styles.wrap} ${styles[primaryTask.status] || ""}`}>
      <div className={styles.banner} role="status" aria-live="polite">
        <div className={styles.leading}>
          <span className={styles.pulse} aria-hidden="true" />
          <div className={styles.texts}>
            <div className={styles.title}>{headerTitle}</div>
            <div className={styles.message}>{headerMessage}</div>
          </div>
        </div>

        <div className={styles.trailing}>
          {!isMulti && typeof primaryTask.progress === "number" ? (
            <div className={styles.progressMeta}>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{
                    width: `${Math.max(6, Math.min(100, primaryTask.progress))}%`,
                  }}
                />
              </div>
              <span className={styles.progressValue}>
                {Math.round(primaryTask.progress)}%
              </span>
            </div>
          ) : null}

          {!isMulti && primaryTask.estimatedRemainingMs ? (
            <span className={styles.etaText}>
              {formatRemaining(primaryTask.estimatedRemainingMs)}
            </span>
          ) : null}

          {!isMulti &&
          primaryTask.actionTo &&
          primaryTask.status !== "running" ? (
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => handleAction(primaryTask)}
            >
              {primaryTask.actionLabel || "查看详情"}
            </button>
          ) : null}

          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => setGenerationBannerExpanded(!expanded)}
            aria-expanded={expanded}
          >
            {expanded ? "收起 ▴" : "展开 ▾"}
          </button>

          <button
            type="button"
            className={styles.closeBtn}
            onClick={handleCloseAll}
            aria-label="关闭全部任务"
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
      </div>

      <div className={`${styles.panel} ${expanded ? styles.panelOpen : ""}`}>
        <div className={styles.taskList}>
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`${styles.taskItem} ${styles[task.status] || ""}`}
            >
              <div className={styles.taskTop}>
                <div className={styles.taskTexts}>
                  <div className={styles.taskTitle}>{task.title}</div>
                  <div className={styles.taskMessage}>{task.message}</div>
                </div>
                <div className={styles.taskRight}>
                  <span className={styles.taskStatus}>
                    {statusLabel[task.status] ?? task.status}
                  </span>
                  <button
                    type="button"
                    className={styles.taskCloseBtn}
                    onClick={() => handleCloseOne(task)}
                    aria-label="关闭此任务"
                  >
                    <svg
                      viewBox="0 0 16 16"
                      width="12"
                      height="12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="4" y1="4" x2="12" y2="12" />
                      <line x1="12" y1="4" x2="4" y2="12" />
                    </svg>
                  </button>
                </div>
              </div>

              {typeof task.progress === "number" ? (
                <div className={styles.taskMetaRow}>
                  <div className={styles.taskProgressMeta}>
                    <div className={styles.taskProgressBar}>
                      <div
                        className={styles.taskProgressFill}
                        style={{
                          width: `${Math.max(6, Math.min(100, task.progress))}%`,
                        }}
                      />
                    </div>
                    <span className={styles.progressValue}>
                      {Math.round(task.progress)}%
                    </span>
                  </div>
                  {task.estimatedRemainingMs ? (
                    <span className={styles.taskAuxText}>
                      {formatRemaining(task.estimatedRemainingMs)}
                    </span>
                  ) : null}
                </div>
              ) : null}

              {task.actionTo && task.status !== "running" ? (
                <div className={styles.taskActions}>
                  <button
                    type="button"
                    className={styles.taskActionBtn}
                    onClick={() => handleAction(task)}
                  >
                    {task.actionLabel || "查看详情"}
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AIGenerationBanner;
