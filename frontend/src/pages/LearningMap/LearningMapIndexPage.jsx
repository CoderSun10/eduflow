import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/common/Button.jsx";
import { useSpeechRecognition } from "../../hooks/useSpeechRecognition.js";
import {
  useGenerateLearningMap,
  useLearningMaps,
} from "../../hooks/useLearningMap.js";
import { RoutePaths } from "../../constants/routes.js";
import { useUiStore } from "../../store/uiStore.js";
import { formatDateTime, formatElapsedSpan } from "../../utils/format.js";
import styles from "./LearningMapIndexPage.module.css";

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

const openLearningMapDetail = (navigate, path) => {
  navigate(path);
};

const LearningMapIndexPage = () => {
  const navigate = useNavigate();
  const [goal, setGoal] = useState("");
  const { learningMaps, isLoading: mapsLoading } = useLearningMaps();
  const generateLearningMap = useGenerateLearningMap();
  const startGenerationTask = useUiStore((s) => s.startGenerationTask);
  const failGenerationTask = useUiStore((s) => s.failGenerationTask);
  const dismissGenerationTask = useUiStore((s) => s.dismissGenerationTask);
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

  const handleGenerate = async () => {
    const trimmed = goal.trim();
    if (!trimmed) return;

    const taskId = `map:${Date.now()}`;
    startGenerationTask({
      id: taskId,
      kind: "map",
      title: "AI 正在生成学习地图",
      message: "正在检索最新学习资源，完成后会自动跳转到地图详情…",
      progress: 5,
    });

    try {
      const data = await generateLearningMap.mutateAsync({ goal: trimmed });
      dismissGenerationTask(taskId);
      setGoal("");
      if (data?.id) {
        navigate(RoutePaths.learningMapOf(data.id));
      }
    } catch (err) {
      failGenerationTask(taskId, {
        title: "学习地图生成失败",
        message: err?.message ?? "请稍后重试。",
      });
    }
  };

  return (
    <div className={styles.page}>
      <section className={styles.heroShell}>
        <div className={styles.heroMain}>
          <div className={styles.heroEyebrow}>Learning Map Hub</div>
          <h1 className={styles.title}>学习地图</h1>
          <p className={styles.subtitle}>
            在这里描述你的长期目标、基础与期望产出，AI
            会为你生成一张完整的学习路线图，并直接进入详情页继续查看。
          </p>
        </div>
        <aside className={styles.heroMetaCard}>
          <span className={styles.heroMetaLabel}>已保存地图</span>
          <strong className={styles.heroMetaValue}>
            {learningMaps.length}
          </strong>
          <span className={styles.heroMetaHint}>
            每次生成后都会自动保存，并可随时回到右侧历史区域继续查看。
          </span>
        </aside>
      </section>

      <section className={styles.layoutGrid}>
        <section className={styles.composer}>
          <div className={styles.sectionHeadRow}>
            <div>
              <h2 className={styles.sectionTitle}>创建新的学习地图</h2>
              <p className={styles.sectionSubtitle}>
                描述你的长期目标、基础、想掌握的方向或期望产出，生成后会进入地图详情。
              </p>
            </div>
          </div>
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
                生成并打开详情页
              </Button>
            </div>
          </div>
        </section>

        <section className={styles.historyPanel}>
          <div className={styles.sectionHeadRow}>
            <div>
              <h2 className={styles.sectionTitle}>已有学习地图</h2>
              <p className={styles.sectionSubtitle}>
                点击卡片后可继续查看这张地图的完整内容。
              </p>
            </div>
          </div>

          {mapsLoading ? (
            <div className={styles.stateBox}>正在加载学习地图历史…</div>
          ) : learningMaps.length === 0 ? (
            <div className={styles.stateBox}>
              你还没有保存过学习地图，先在左侧创建第一张吧。
            </div>
          ) : (
            <div className={styles.historyList}>
              {learningMaps.map((item) => (
                <div key={item.id} className={styles.historyCard}>
                  <button
                    type="button"
                    className={styles.historyOpenBtn}
                    onClick={() =>
                      openLearningMapDetail(
                        navigate,
                        RoutePaths.learningMapOf(item.id),
                      )
                    }
                  >
                    <div className={styles.historyTop}>
                      <span className={styles.historyBadge}>学习地图</span>
                      <span className={styles.historyDate}>
                        最近更新 {formatDateTime(item.updatedAt)}
                      </span>
                    </div>
                    <div className={styles.historyTitle}>
                      {item.title || item.goal}
                    </div>
                    <div className={styles.historyGoal}>{item.goal}</div>
                    <div className={styles.historyMeta}>
                      <span>生成于 {formatDateTime(item.createdAt)}</span>
                      <span>
                        持续 {formatElapsedSpan(item.createdAt, item.updatedAt)}
                      </span>
                    </div>
                  </button>
                  <div className={styles.historyFooter}>
                    <span>进入地图详情</span>
                    <span>查看路线与进度</span>
                  </div>
                </div>
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
    </div>
  );
};

export default LearningMapIndexPage;
