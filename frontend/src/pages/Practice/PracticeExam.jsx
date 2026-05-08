/**
 * PracticeExam — 共用答题组件
 *
 * 渲染混合题型（选择 / 填空 / 代码），支持逐题答题、AI 批改、结果展示。
 * 综合练习 & 项目挑战的代码题支持文件上传。
 */
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGradeAnswer } from "../../hooks/usePractice.js";
import MarkdownRenderer from "../../components/common/MarkdownRenderer.jsx";
import styles from "./PracticeExam.module.css";

const Stars = ({ count, max = 3 }) => (
  <span className={styles.stars}>
    {Array.from({ length: max }, (_, i) => (
      <span
        key={i}
        className={i < count ? styles.starFilled : styles.starEmpty}
      >
        ★
      </span>
    ))}
  </span>
);

const TYPE_LABEL = { choice: "选择题", fill: "填空题", code: "代码实操" };

const splitChoiceOption = (option) => {
  const text = String(option ?? "").trim();
  const match = text.match(/^([A-Z])[.、)）:\-\s]+([\s\S]*)$/);

  if (!match) {
    return { label: "", content: text };
  }

  return {
    label: match[1],
    content: match[2]?.trim() || text,
  };
};

const PracticeExam = ({
  problems,
  practiceSessionId,
  language,
  allowUpload = false,
  onFinish,
}) => {
  const navigate = useNavigate();
  const gradeMutation = useGradeAnswer();
  const fileInputRef = useRef(null);

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState(() =>
    problems.map(() => ({ value: "", graded: false, result: null })),
  );
  const [showExplanation, setShowExplanation] = useState(false);

  const p = problems[current];
  const ans = answers[current];

  const updateAnswer = (val) => {
    setAnswers((prev) =>
      prev.map((a, i) => (i === current ? { ...a, value: val } : a)),
    );
  };

  const doGrade = async () => {
    if (!ans.value.trim()) return;
    const correctAnswer = p.type === "code" ? p.solution : p.answer;
    try {
      const result = await gradeMutation.mutateAsync({
        practiceSessionId,
        problemIndex: current,
        problemType: p.type,
        problemDescription: p.description,
        correctAnswer: correctAnswer ?? "",
        userAnswer: ans.value,
        language,
      });
      setAnswers((prev) =>
        prev.map((a, i) =>
          i === current ? { ...a, graded: true, result } : a,
        ),
      );
    } catch {
      /* noop */
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => updateAnswer(ev.target.result);
    reader.readAsText(file);
    e.target.value = "";
  };

  const allGraded = answers.every((a) => a.graded);
  const totalCorrect = answers.filter((a) => a.result?.isCorrect).length;

  useEffect(() => {
    setShowExplanation(false);
  }, [current]);

  return (
    <div className={styles.exam}>
      {/* 题目卡片 — 固定容器尺寸，避免操作按钮位置抖动 */}
      <div className={styles.card}>
        <div className={styles.cardScroll}>
          <div className={styles.cardHeader}>
            <span className={styles.typeBadge}>
              {TYPE_LABEL[p.type] || p.type}
            </span>
            <Stars count={p.difficulty} />
            {p.tags?.map((t) => (
              <span key={t} className={styles.tag}>
                {t}
              </span>
            ))}
            <span className={styles.questionIndex}>
              第 {current + 1} / {problems.length} 题
            </span>
          </div>

          <h3 className={styles.cardTitle}>{p.title}</h3>

          <MarkdownRenderer
            content={p.description}
            className={styles.cardDesc}
          />

          {/* ── 选择题 ── */}
          {p.type === "choice" && (
            <div className={styles.optionList}>
              {p.options?.map((opt, oi) => {
                const { label, content } = splitChoiceOption(opt);
                const letter = label || opt.charAt(0);
                const isSelected = ans.value === letter;
                const graded = ans.graded;
                const isCorrectOpt = p.answer === letter;
                let cls = styles.option;
                if (isSelected) cls += ` ${styles.optionSelected}`;
                if (graded && isCorrectOpt) cls += ` ${styles.optionCorrect}`;
                if (graded && isSelected && !isCorrectOpt)
                  cls += ` ${styles.optionWrong}`;
                return (
                  <button
                    key={oi}
                    type="button"
                    className={cls}
                    disabled={graded}
                    onClick={() => updateAnswer(letter)}
                  >
                    {label ? (
                      <span className={styles.optionLabel}>{label}.</span>
                    ) : null}
                    <MarkdownRenderer
                      content={content || opt}
                      className={styles.optionContent}
                    />
                  </button>
                );
              })}
            </div>
          )}

          {/* ── 填空题 ── */}
          {p.type === "fill" && (
            <input
              className={styles.fillInput}
              type="text"
              placeholder="请输入答案…"
              value={ans.value}
              onChange={(e) => updateAnswer(e.target.value)}
              disabled={ans.graded}
            />
          )}

          {/* ── 代码题 ── */}
          {p.type === "code" && (
            <div className={styles.codeArea}>
              {allowUpload && (
                <div className={styles.codeToolbar}>
                  <button
                    type="button"
                    className={styles.uploadBtn}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    上传代码文件
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".c,.cpp,.py,.java,.js,.ts,.go,.rs,.txt"
                    style={{ display: "none" }}
                    onChange={handleFileUpload}
                  />
                </div>
              )}
              <textarea
                className={styles.codeEditor}
                value={ans.value || (p.starterCode ?? "")}
                onChange={(e) => updateAnswer(e.target.value)}
                placeholder="在此编写代码…"
                spellCheck={false}
                disabled={ans.graded}
              />
            </div>
          )}

          {/* 批改结果（在卡片可滚动区内）*/}
          {ans.graded && ans.result && (
            <div
              className={`${styles.resultBlock} ${ans.result.isCorrect ? styles.resultCorrect : styles.resultWrong}`}
            >
              <div className={styles.resultHeader}>
                <span className={styles.resultIcon}>
                  {ans.result.isCorrect ? "✓" : "✗"}
                </span>
                <span className={styles.resultLabel}>
                  {ans.result.isCorrect ? "回答正确" : "回答错误"}
                </span>
                {ans.result.score !== undefined && (
                  <span className={styles.resultScore}>
                    得分 {ans.result.score}
                  </span>
                )}
              </div>
              <MarkdownRenderer
                content={ans.result.feedback || ""}
                className={styles.resultFeedback}
              />

              {/* 代码题四维评分 */}
              {p.type === "code" && ans.result.codeReview && (
                <div className={styles.codeReviewGrid}>
                  {["correctness", "readability", "efficiency", "style"].map(
                    (dim) =>
                      ans.result.codeReview[dim] ? (
                        <div key={dim} className={styles.reviewDim}>
                          <span className={styles.reviewLabel}>
                            {dim === "correctness"
                              ? "正确性"
                              : dim === "readability"
                                ? "可读性"
                                : dim === "efficiency"
                                  ? "效率"
                                  : "风格"}
                          </span>
                          <div className={styles.reviewBar}>
                            <div
                              className={styles.reviewFill}
                              style={{
                                width: `${ans.result.codeReview[dim].score}%`,
                                background:
                                  ans.result.codeReview[dim].score >= 80
                                    ? "#22c55e"
                                    : ans.result.codeReview[dim].score >= 60
                                      ? "#f59e0b"
                                      : "#ef4444",
                              }}
                            />
                          </div>
                          <span className={styles.reviewScore}>
                            {ans.result.codeReview[dim].score}
                          </span>
                        </div>
                      ) : null,
                  )}
                </div>
              )}
            </div>
          )}

          {/* 解析 */}
          {showExplanation && p.explanation && (
            <div className={styles.explanationBlock}>
              <div className={styles.explanationTitle}>题目解析</div>
              <MarkdownRenderer content={p.explanation} />
              {p.type === "code" && p.solution && (
                <>
                  <div
                    className={styles.explanationTitle}
                    style={{ marginTop: 12 }}
                  >
                    参考代码
                  </div>
                  <MarkdownRenderer
                    content={`\`\`\`${language?.toLowerCase() || ""}\n${p.solution}\n\`\`\``}
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* 底部固定区：题号导航 + 操作按钮 */}
        <div className={styles.cardFooter}>
          <div className={styles.progressBar}>
            {problems.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`${styles.dot} ${i === current ? styles.dotCurrent : ""} ${answers[i].graded ? (answers[i].result?.isCorrect ? styles.dotCorrect : styles.dotWrong) : ""}`}
                onClick={() => setCurrent(i)}
                aria-label={`第 ${i + 1} 题`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          <div className={styles.actions}>
            {!ans.graded ? (
              <button
                type="button"
                className={styles.submitBtn}
                disabled={!ans.value.trim() || gradeMutation.isPending}
                onClick={doGrade}
              >
                {gradeMutation.isPending ? "AI 批改中…" : "提交答案"}
              </button>
            ) : (
              <button
                type="button"
                className={styles.explanationBtn}
                onClick={() => setShowExplanation(!showExplanation)}
              >
                {showExplanation ? "收起解析" : "查看解析"}
              </button>
            )}

            <div className={styles.navBtns}>
              <button
                type="button"
                className={styles.navBtn}
                disabled={current === 0}
                onClick={() => setCurrent(current - 1)}
              >
                上一题
              </button>
              <button
                type="button"
                className={styles.navBtn}
                disabled={current >= problems.length - 1}
                onClick={() => setCurrent(current + 1)}
              >
                下一题
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 答题完成总结 */}
      {allGraded && (
        <div className={styles.summary}>
          <div className={styles.summaryTitle}>练习完成</div>
          <div className={styles.summaryRow}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryNum}>{problems.length}</span>
              <span className={styles.summaryLabel}>总题数</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={`${styles.summaryNum} ${styles.correctNum}`}>
                {totalCorrect}
              </span>
              <span className={styles.summaryLabel}>正确</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={`${styles.summaryNum} ${styles.wrongNum}`}>
                {problems.length - totalCorrect}
              </span>
              <span className={styles.summaryLabel}>错误</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryNum}>
                {Math.round((totalCorrect / problems.length) * 100)}%
              </span>
              <span className={styles.summaryLabel}>正确率</span>
            </div>
          </div>
          <button
            type="button"
            className={styles.backBtn}
            onClick={onFinish || (() => navigate("/practice"))}
          >
            返回练习中心
          </button>
        </div>
      )}
    </div>
  );
};

export default PracticeExam;
