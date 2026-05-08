import { useEffect, useMemo } from "react";
import { sessionApi } from "../../api/sessionApi.js";
import { RoutePaths } from "../../constants/routes.js";
import { useAuthStore } from "../../store/authStore.js";
import { useUiStore } from "../../store/uiStore.js";
import { StorageKeys } from "../../constants/storageKeys.js";
import { storage } from "../../utils/storage.js";

const SHORT_IDLE_MS = 2 * 60 * 60 * 1000;
const LONG_IDLE_MS = 14 * 24 * 60 * 60 * 1000;
const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "scroll",
  "mousemove",
  "touchstart",
];

const isReadyForWorkbench = (data) => {
  const blueprintItem = data?.items?.find((item) => item.scope === "blueprint");
  if (blueprintItem?.status !== "done") return false;

  const nodeContentTotal = data?.summary?.node_content?.total ?? 0;
  const nodeContentDone = data?.summary?.node_content?.done ?? 0;
  const requiredReadyCount = Math.min(3, nodeContentTotal);

  if (requiredReadyCount === 0) return true;
  return nodeContentDone >= requiredReadyCount;
};

const computeProgressPercent = (progress) => {
  if (!progress) return 5;
  const blueprintItem = progress.items?.find(
    (item) => item.scope === "blueprint",
  );
  if (!blueprintItem) return 5;
  if (blueprintItem.status === "running") return 35;
  if (blueprintItem.status === "done") {
    const nodeContentTotal = progress.summary?.node_content?.total ?? 0;
    const nodeContentDone = progress.summary?.node_content?.done ?? 0;
    if (nodeContentTotal === 0) return 80;
    const ratio = nodeContentDone / nodeContentTotal;
    return 50 + Math.min(50, Math.round(ratio * 50));
  }
  if (blueprintItem.status === "failed") return 0;
  return 15;
};

const computeStageMessage = (progress) => {
  if (!progress) return "正在解析你提供的意图…";
  const blueprintItem = progress.items?.find(
    (item) => item.scope === "blueprint",
  );
  if (blueprintItem?.status === "running") {
    return blueprintItem.detail?.stage === "searching"
      ? "正在搜索最新官方文档…"
      : "AI 正在构建知识蓝图…";
  }
  if (blueprintItem?.status === "done") {
    const nodeContentRunning = progress.summary?.node_content?.running ?? 0;
    const nodeContentDone = progress.summary?.node_content?.done ?? 0;
    const nodeContentTotal = progress.summary?.node_content?.total ?? 0;
    const atomicPracticeDone = progress.summary?.atomic_practice?.done ?? 0;
    const atomicPracticeTotal = progress.summary?.atomic_practice?.total ?? 0;
    if (
      nodeContentRunning > 0 ||
      nodeContentDone < Math.min(3, nodeContentTotal)
    ) {
      return `正在预生成前几个学习内容（${nodeContentDone}/${Math.min(3, nodeContentTotal)}）…`;
    }
    if (
      atomicPracticeTotal > 0 &&
      atomicPracticeDone < Math.min(3, atomicPracticeTotal)
    ) {
      return `正在准备前几个专项例题（${atomicPracticeDone}/${Math.min(3, atomicPracticeTotal)}）…`;
    }
    return "蓝图已就绪，你可以随时进入工作台。";
  }
  return "AI 正在工作…";
};

const computeEstimatedRemainingMs = (task, progressPercent) => {
  if (!task?.startedAt || typeof progressPercent !== "number") return null;
  if (progressPercent < 8 || progressPercent >= 100) return null;
  const elapsed = Date.now() - task.startedAt;
  if (elapsed < 8000) return null;
  const remaining = Math.round(
    (elapsed / progressPercent) * (100 - progressPercent),
  );
  return Math.max(0, Math.min(60 * 60 * 1000, remaining));
};

const AppRuntime = () => {
  const generationTasks = useUiStore((s) => s.generationTasks);
  const updateGenerationTask = useUiStore((s) => s.updateGenerationTask);
  const completeGenerationTask = useUiStore((s) => s.completeGenerationTask);
  const failGenerationTask = useUiStore((s) => s.failGenerationTask);

  const runningSessionTasks = useMemo(
    () =>
      generationTasks.filter(
        (task) =>
          task.kind === "session" &&
          task.status === "running" &&
          Boolean(task.sessionId),
      ),
    [generationTasks],
  );

  const runningTaskKeys = useMemo(
    () =>
      runningSessionTasks
        .map((task) => `${task.id}:${task.sessionId}:${task.status}`)
        .sort()
        .join("|"),
    [runningSessionTasks],
  );

  useEffect(() => {
    const syncActivity = () => {
      const isRemembered = Boolean(storage.getAny(StorageKeys.AUTH_REMEMBER));
      const timeout = isRemembered ? LONG_IDLE_MS : SHORT_IDLE_MS;
      storage.set(
        StorageKeys.AUTH_LAST_ACTIVE_AT,
        Date.now(),
        isRemembered ? "local" : "session",
      );
      storage.set(
        StorageKeys.AUTH_IDLE_TIMEOUT_MS,
        timeout,
        isRemembered ? "local" : "session",
      );
    };

    let lastWriteAt = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastWriteAt < 15000) return;
      lastWriteAt = now;
      if (useAuthStore.getState().accessToken) {
        syncActivity();
      }
    };

    const checkTimeout = () => {
      const authState = useAuthStore.getState();
      if (!authState.accessToken) return;
      const lastActiveAt = Number(
        storage.getAny(StorageKeys.AUTH_LAST_ACTIVE_AT) || 0,
      );
      const idleTimeoutMs = Number(
        storage.getAny(StorageKeys.AUTH_IDLE_TIMEOUT_MS) || SHORT_IDLE_MS,
      );
      if (!lastActiveAt) {
        syncActivity();
        return;
      }
      if (Date.now() - lastActiveAt < idleTimeoutMs) return;

      authState.clear();
      storage.set(
        StorageKeys.AUTH_LOGOUT_REASON,
        "登录已过期，请重新登录",
        "session",
      );
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    };

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, onActivity, { passive: true });
    });

    const timer = window.setInterval(checkTimeout, 30000);
    checkTimeout();

    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, onActivity);
      });
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!runningSessionTasks.length) {
      return undefined;
    }

    const stopFlags = new Map();
    const consecutiveErrors = new Map();
    const pollIntervalMs = Math.max(4000, runningSessionTasks.length * 2500);
    let polling = false;

    runningSessionTasks.forEach((task) => {
      stopFlags.set(task.id, false);
      consecutiveErrors.set(task.id, 0);
    });

    const tickTask = async (task) => {
      try {
        const progress = await sessionApi.getGenerationProgress(task.sessionId);
        if (stopFlags.get(task.id)) return;

        consecutiveErrors.set(task.id, 0);
        const blueprintItem = progress?.items?.find(
          (item) => item.scope === "blueprint",
        );
        const progressPercent = computeProgressPercent(progress);

        updateGenerationTask(task.id, {
          message: computeStageMessage(progress),
          progress: progressPercent,
          estimatedRemainingMs: computeEstimatedRemainingMs(
            task,
            progressPercent,
          ),
        });

        if (isReadyForWorkbench(progress)) {
          stopFlags.set(task.id, true);
          const doneSubject = task.subjectName || "";
          completeGenerationTask(task.id, {
            title: doneSubject
              ? `「${doneSubject}」知识蓝图已就绪`
              : "知识蓝图已生成完成",
            message: "首批学习内容已准备好，你可以现在进入工作台。",
            actionLabel: "进入工作台",
            actionTo: RoutePaths.workbenchOf(task.sessionId),
            estimatedRemainingMs: 0,
          });
        } else if (blueprintItem?.status === "failed") {
          stopFlags.set(task.id, true);
          const failSubject = task.subjectName || "";
          failGenerationTask(task.id, {
            title: failSubject
              ? `「${failSubject}」蓝图生成失败`
              : "知识蓝图生成失败",
            message: blueprintItem.error ?? "请稍后重试。",
            progress: 0,
            estimatedRemainingMs: null,
          });
        }
      } catch (error) {
        if (error?.status === 429 || error?.code === 429) {
          updateGenerationTask(task.id, {
            message: "当前生成任务较多，已自动放慢刷新频率…",
          });
          return;
        }

        const nextErrorCount = (consecutiveErrors.get(task.id) ?? 0) + 1;
        consecutiveErrors.set(task.id, nextErrorCount);
        if (nextErrorCount >= 5) {
          stopFlags.set(task.id, true);
          failGenerationTask(task.id, {
            title: "知识蓝图进度获取失败",
            message: error.message ?? "请稍后重试。",
            estimatedRemainingMs: null,
          });
        }
      }
    };

    const tickAll = async () => {
      if (polling) return;
      polling = true;
      try {
        for (const task of runningSessionTasks) {
          if (stopFlags.get(task.id)) continue;
          await tickTask(task);
        }
      } finally {
        polling = false;
      }
    };

    tickAll();
    const timer = window.setInterval(tickAll, pollIntervalMs);

    return () => {
      stopFlags.forEach((_value, key) => {
        stopFlags.set(key, true);
      });
      window.clearInterval(timer);
    };
  }, [
    completeGenerationTask,
    failGenerationTask,
    runningTaskKeys,
    updateGenerationTask,
  ]);

  return null;
};

export default AppRuntime;
