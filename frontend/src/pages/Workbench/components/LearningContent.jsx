/**
 * 工作台中栏：AI 生成的知识讲解 + Monaco 代码编辑器
 *
 * 选中节点后通过 AI 生成详细教程内容，使用 Monaco Editor 提供代码练习环境，
 * 代码提交后调用 AI 进行 4D 代码评价。
 */
import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import Button from "../../../components/common/Button.jsx";
import { useNodeContent, useCodeReview } from "../../../hooks/useAI.js";
import { useTheme } from "../../../hooks/useTheme.jsx";
import MarkdownRenderer from "../../../components/common/MarkdownRenderer.jsx";
import styles from "./LearningContent.module.css";

/** 语言 → Monaco 语言 id */
const langMap = {
  C: "c",
  "C++": "cpp",
  Python: "python",
  Java: "java",
  JavaScript: "javascript",
  Go: "go",
  Rust: "rust",
  React: "javascript",
  TypeScript: "typescript",
};

/** AI 生成内容时的骨架屏 + 动态提示 */
const LOADING_MESSAGES = [
  "AI 正在分析知识结构…",
  "正在生成详细讲解内容…",
  "正在编写代码示例…",
  "正在设计练习题目…",
  "正在提炼核心要点…",
  "即将完成，请稍候…",
];

const LoadingSkeleton = () => {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={styles.skeletonWrap}>
      <div className={styles.skeletonHeader}>
        <div className={styles.skeletonPulse}>
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
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
        <span className={styles.skeletonMsg}>{LOADING_MESSAGES[msgIdx]}</span>
      </div>
      <div className={styles.skeletonLines}>
        <div className={`${styles.skeletonLine} ${styles.skeletonW90}`} />
        <div className={`${styles.skeletonLine} ${styles.skeletonW70}`} />
        <div className={`${styles.skeletonLine} ${styles.skeletonW80}`} />
        <div className={`${styles.skeletonLine} ${styles.skeletonW60}`} />
      </div>
      <div className={styles.skeletonBlock} />
      <div className={styles.skeletonLines}>
        <div className={`${styles.skeletonLine} ${styles.skeletonW80}`} />
        <div className={`${styles.skeletonLine} ${styles.skeletonW50}`} />
        <div className={`${styles.skeletonLine} ${styles.skeletonW70}`} />
      </div>
    </div>
  );
};

const LearningContent = ({
  node,
  nodePath,
  sessionId,
  language,
  onAdvance,
}) => {
  const [codeState, setCodeState] = useState({ key: "", value: "" });
  const [reviewState, setReviewState] = useState({ key: "", value: null });
  const [completeMsgState, setCompleteMsgState] = useState({
    key: "",
    value: "",
  });
  const [answerMsgState, setAnswerMsgState] = useState({ key: "", value: "" });
  const [showMathAnswerState, setShowMathAnswerState] = useState({
    key: "",
    value: false,
  });
  const { theme } = useTheme();
  const monacoTheme = theme === "dark" ? "vs-dark" : "vs";

  const {
    content,
    isLoading: contentLoading,
    error: contentError,
    refetch: refetchContent,
  } = useNodeContent(sessionId, node?.id);
  const codeReviewMutation = useCodeReview(sessionId);
  const resolvedContent = content?.content ?? content;
  const isMathExercise =
    resolvedContent?.exerciseType === "math" ||
    !!resolvedContent?.practiceExercise;
  const contentKey = `${node?.id ?? "none"}::${resolvedContent?.codeExercise?.title ?? resolvedContent?.practiceExercise?.title ?? ""}`;
  const code =
    codeState.key === contentKey
      ? codeState.value
      : (resolvedContent?.codeExercise?.starterCode ?? "");
  const review = reviewState.key === contentKey ? reviewState.value : null;
  const completeMsg =
    completeMsgState.key === contentKey ? completeMsgState.value : "";
  const answerMsg =
    answerMsgState.key === contentKey ? answerMsgState.value : "";
  const showMathAnswer =
    showMathAnswerState.key === contentKey ? showMathAnswerState.value : false;

  const monacoLang = langMap[language] ?? "plaintext";

  if (!node) {
    return (
      <article className={styles.content}>
        <div className={styles.emptyState}>选择左侧知识节点开始学习</div>
      </article>
    );
  }

  const handleSubmitReview = async () => {
    if (!code.trim()) return;
    try {
      const result = await codeReviewMutation.mutateAsync({
        code,
        exerciseTitle: resolvedContent?.codeExercise?.title ?? node.name,
        nodeId: node.id,
      });
      setReviewState({ key: contentKey, value: result });
    } catch (err) {
      console.error("代码评价失败", err);
    }
  };

  const handleComplete = () => {
    if (onAdvance && node.id) {
      onAdvance(node.id, "done");
      setCompleteMsgState({ key: contentKey, value: "已标记完成 ✓" });
      setTimeout(() => {
        setCompleteMsgState((prev) =>
          prev.key === contentKey ? { key: contentKey, value: "" } : prev,
        );
      }, 2500);
    }
  };

  const handleShowAnswer = () => {
    if (resolvedContent?.codeExercise?.solution) {
      setCodeState({
        key: contentKey,
        value: resolvedContent.codeExercise.solution,
      });
      setAnswerMsgState({ key: contentKey, value: "已加载参考答案" });
      setTimeout(() => {
        setAnswerMsgState((prev) =>
          prev.key === contentKey ? { key: contentKey, value: "" } : prev,
        );
      }, 2500);
    }
  };

  const handleShowMathAnswer = () => {
    if (resolvedContent?.practiceExercise?.solution) {
      const nextVisible = !showMathAnswer;
      setShowMathAnswerState({ key: contentKey, value: nextVisible });
      setAnswerMsgState({
        key: contentKey,
        value: nextVisible ? "已展开参考解答" : "已收起参考解答",
      });
      setTimeout(() => {
        setAnswerMsgState((prev) =>
          prev.key === contentKey ? { key: contentKey, value: "" } : prev,
        );
      }, 2500);
    }
  };

  return (
    <article className={styles.content}>
      <div className={styles.phase}>
        {nodePath} · {node.status === "done" ? "已完成" : "学习中"}
      </div>
      <h2 className={styles.title}>{node.name}</h2>

      {contentLoading ? (
        <LoadingSkeleton />
      ) : contentError ? (
        <div className={styles.stateCard}>
          <div className={styles.stateTitle}>AI 内容暂时还没准备好</div>
          <p className={styles.stateDesc}>
            {contentError.message ?? "当前节点内容生成失败，请稍后重试。"}
          </p>
          <div className={styles.stateActions}>
            <Button size="sm" onClick={() => refetchContent()}>
              重新获取内容
            </Button>
          </div>
        </div>
      ) : resolvedContent ? (
        <>
          {/* 知识讲解 */}
          {resolvedContent.explanation && (
            <MarkdownRenderer
              content={resolvedContent.explanation}
              className={styles.body}
            />
          )}

          {/* 要点提炼 */}
          {resolvedContent.keyPoints?.length > 0 && (
            <aside className={styles.refBlock}>
              <span className={styles.refTag}>要点</span>
              <div>
                <ul className={styles.keyPoints}>
                  {resolvedContent.keyPoints.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            </aside>
          )}

          {/* 数学练习 */}
          {isMathExercise && resolvedContent.practiceExercise && (
            <div className={styles.exercise}>
              <div className={styles.exLabel}>
                练习 · {resolvedContent.practiceExercise.title}
              </div>
              <MarkdownRenderer
                content={resolvedContent.practiceExercise.description}
                className={styles.exQuestion}
              />

              <div className={styles.mathHintBox}>
                <div className={styles.mathHintTitle}>建议作答方式</div>
                <div className={styles.mathHintText}>
                  你可以先自行在纸上推导，再结合右侧 AI
                  助教直接查看关键步骤与答案；该区域会长期展示题目与参考解答。
                </div>
              </div>

              {showMathAnswer && resolvedContent.practiceExercise.solution && (
                <div className={styles.mathSolutionBlock}>
                  <div className={styles.explanationTitle}>参考解答</div>
                  <MarkdownRenderer
                    content={resolvedContent.practiceExercise.solution}
                    className={styles.body}
                  />
                </div>
              )}

              {resolvedContent.practiceExercise.testCases && (
                <div className={styles.mathSolutionBlock}>
                  <div className={styles.explanationTitle}>自检建议</div>
                  <MarkdownRenderer
                    content={resolvedContent.practiceExercise.testCases}
                    className={styles.body}
                  />
                </div>
              )}

              <div className={styles.exButtons}>
                <Button variant="secondary" size="sm" onClick={handleComplete}>
                  {completeMsg || "标记完成"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleShowMathAnswer}
                >
                  {answerMsg || (showMathAnswer ? "收起解答" : "查看解答")}
                </Button>
              </div>
            </div>
          )}

          {/* 代码练习 */}
          {!isMathExercise && resolvedContent.codeExercise && (
            <div className={styles.exercise}>
              <div className={styles.exLabel}>
                练习 · {resolvedContent.codeExercise.title}
              </div>
              <p className={styles.exQuestion}>
                {resolvedContent.codeExercise.description}
              </p>

              <div className={styles.editorWrap}>
                <Editor
                  height="240px"
                  language={monacoLang}
                  value={code}
                  onChange={(v) =>
                    setCodeState({ key: contentKey, value: v ?? "" })
                  }
                  theme={monacoTheme}
                  options={{
                    fontSize: 13,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    lineNumbers: "on",
                    wordWrap: "on",
                    tabSize: 2,
                    automaticLayout: true,
                  }}
                />
              </div>

              <div className={styles.exButtons}>
                <Button
                  onClick={handleSubmitReview}
                  size="sm"
                  loading={codeReviewMutation.isPending}
                >
                  AI 评价代码
                </Button>
                <Button variant="secondary" size="sm" onClick={handleComplete}>
                  {completeMsg || "标记完成"}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleShowAnswer}>
                  {answerMsg || "查看答案"}
                </Button>
              </div>
            </div>
          )}

          {/* 代码评价结果 */}
          {review && (
            <div className={styles.reviewBlock}>
              <div className={styles.reviewTitle}>AI 代码评价</div>
              <div className={styles.reviewScores}>
                {["correctness", "readability", "efficiency", "style"].map(
                  (dim) =>
                    review[dim] && (
                      <div key={dim} className={styles.scoreDim}>
                        <div className={styles.scoreLabel}>
                          {dim === "correctness"
                            ? "正确性"
                            : dim === "readability"
                              ? "可读性"
                              : dim === "efficiency"
                                ? "效率"
                                : "风格"}
                        </div>
                        <div className={styles.scoreBar}>
                          <div
                            className={styles.scoreFill}
                            style={{
                              width: `${review[dim].score}%`,
                              background:
                                review[dim].score >= 80
                                  ? "#22c55e"
                                  : review[dim].score >= 60
                                    ? "#f59e0b"
                                    : "#ef4444",
                            }}
                          />
                        </div>
                        <span className={styles.scoreNum}>
                          {review[dim].score}
                        </span>
                      </div>
                    ),
                )}
              </div>
              {review.suggestion && (
                <p className={styles.reviewSuggestion}>{review.suggestion}</p>
              )}
            </div>
          )}
        </>
      ) : (
        <div className={styles.stateCard}>
          <div className={styles.stateTitle}>AI 正在准备当前知识点内容</div>
          <p className={styles.stateDesc}>
            当前节点已选中，但内容尚未返回。你可以稍等片刻，或手动再次触发加载。
          </p>
          <div className={styles.stateActions}>
            <Button size="sm" onClick={() => refetchContent()}>
              立即刷新
            </Button>
          </div>
        </div>
      )}
    </article>
  );
};

export default LearningContent;
