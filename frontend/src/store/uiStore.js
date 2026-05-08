import { create } from "zustand";

const toTaskId = (task = {}) => {
  if (task.id) return task.id;
  if (task.kind === "session" && task.sessionId) {
    return `session:${task.sessionId}`;
  }
  return `${task.kind ?? "task"}:${Date.now()}`;
};

const upsertTask = (tasks, nextTask) => {
  const existingIndex = tasks.findIndex((task) => task.id === nextTask.id);
  if (existingIndex === -1) {
    return [nextTask, ...tasks];
  }
  return tasks.map((task, index) =>
    index === existingIndex ? { ...task, ...nextTask } : task,
  );
};

export const useUiStore = create((set) => ({
  generationTasks: [],
  generationBannerExpanded: false,
  generationFullscreen: false,

  setGenerationFullscreen: (v) => set({ generationFullscreen: v }),

  startGenerationTask: (task) =>
    set((state) => {
      const nextTask = {
        id: toTaskId(task),
        status: "running",
        progress: 0,
        actionLabel: "查看详情",
        autoCloseAt: null,
        createdAt: task.createdAt ?? Date.now(),
        startedAt: task.startedAt ?? Date.now(),
        ...task,
        updatedAt: Date.now(),
      };

      return {
        generationTasks: upsertTask(state.generationTasks, nextTask),
        generationFullscreen: true,
      };
    }),

  updateGenerationTask: (taskId, patch = {}) =>
    set((state) => {
      if (!taskId) return state;
      return {
        generationTasks: state.generationTasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                ...patch,
                updatedAt: Date.now(),
              }
            : task,
        ),
      };
    }),

  completeGenerationTask: (taskId, patch = {}) =>
    set((state) => {
      if (!taskId) return state;
      return {
        generationTasks: state.generationTasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                ...patch,
                status: "success",
                progress: 100,
                autoCloseAt: Date.now() + 5000,
                updatedAt: Date.now(),
              }
            : task,
        ),
        generationFullscreen: false,
      };
    }),

  failGenerationTask: (taskIdOrPatch, maybePatch = {}) =>
    set((state) => {
      const taskId =
        typeof taskIdOrPatch === "string"
          ? taskIdOrPatch
          : toTaskId(taskIdOrPatch);
      const patch =
        typeof taskIdOrPatch === "string" ? maybePatch : (taskIdOrPatch ?? {});
      const currentTask = state.generationTasks.find(
        (task) => task.id === taskId,
      );
      const nextTask = {
        ...(currentTask ?? {
          id: taskId,
          createdAt: Date.now(),
          startedAt: Date.now(),
        }),
        ...patch,
        status: "error",
        autoCloseAt: Date.now() + 5000,
        updatedAt: Date.now(),
      };

      return {
        generationTasks: upsertTask(state.generationTasks, nextTask),
      };
    }),

  dismissGenerationTask: (taskId) =>
    set((state) => ({
      generationTasks: taskId
        ? state.generationTasks.filter((task) => task.id !== taskId)
        : [],
    })),

  setGenerationBannerExpanded: (expanded) =>
    set({ generationBannerExpanded: expanded }),
}));
