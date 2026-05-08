import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MarkdownRenderer from "../../components/common/MarkdownRenderer.jsx";
import { usePracticeDetail } from "../../hooks/usePractice.js";
import styles from "./PracticeHistoryDetailPage.module.css";

const MODE_LABEL = {
  focused: "专项练习",
  comprehensive: "综合练习",
  project: "项目挑战",
};

const TYPE_LABEL = {
  choice: "选择题",
  fill: "填空题",
  code: "代码实操",
};

const PracticeHistoryDetailPage = () => {
  const navigate = useNavigate();
  const { historyId } = useParams();
  const { detail, isLoading, error } = usePracticeDetail(historyId);

  const rows = useMemo(() => {
    if (!detail?.problems?.length) return [];
    const answerMap = new Map(
      (detail.answers ?? []).map((answer) => [answer.problemIndex, answer]),
    );

    return detail.problems.map((problem, index) => ({
      index,
      problem,
      answer: answerMap.get(index) ?? null,
    }));
  }, [detail]);

  const stats = useMemo(() => {
    const answers = detail?.answers ?? [];
    const total = detail?.problems?.length ?? 0;
    const answered = answers.length;
    const correct = answers.filter((answer) => answer.isCorrect).length;
    return {
      total,
      answered,
      correct,
      wrong: Math.max(answered - correct, 0),
      accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0,
    };
  }, [detail]);

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.stateCard}>
          <div className={styles.stateTitle}>正在加载练习记录…</div>
          <p className={styles.stateDesc}>请稍候，正在同步本次练习详情。</p>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className={styles.page}>
        <div className={styles.backRow}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => navigate("/practice")}
          >
            返回练习中心
          </button>
        </div>
        <div className={styles.stateCard}>
          <div className={styles.stateTitle}>练习记录无法打开</div>
          <p className={styles.stateDesc}>
            {error?.message ?? "这条练习记录不存在，或你无权查看它。"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.backRow}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => navigate("/practice")}
        >
          返回练习中心
        </button>
      </div>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>练习记录详情</h1>
          <p className={styles.subtitle}>
            {MODE_LABEL[detail.mode] || detail.mode} · {detail.language} ·{" "}
            {new Date(detail.createdAt).toLocaleString()}
          </p>
        </div>
        <div className={styles.modeBadge}>
          {MODE_LABEL[detail.mode] || detail.mode}
        </div>
      </header>

      <section className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{stats.total}</span>
          <span className={styles.statLabel}>总题数</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{stats.answered}</span>
          <span className={styles.statLabel}>已作答</span>
        </div>
        <div className={styles.statCard}>
          <span className={`${styles.statNum} ${styles.correctColor}`}>
            {stats.correct}
          </span>
          <span className={styles.statLabel}>答对</span>
        </div>
        <div className={styles.statCard}>
          <span className={`${styles.statNum} ${styles.wrongColor}`}>
            {stats.wrong}
          </span>
          <span className={styles.statLabel}>答错</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{stats.accuracy}%</span>
          <span className={styles.statLabel}>正确率</span>
        </div>
      </section>

      <section className={styles.questionList}>
        {rows.map(({ index, problem, answer }) => (
          <article
            key={`${detail.id}-${index}`}
            className={styles.questionCard}
          >
            <div className={styles.questionTop}>
              <span className={styles.questionIndex}>第 {index + 1} 题</span>
              <span className={styles.questionType}>
                {TYPE_LABEL[problem.type] || problem.type}
              </span>
              {answer ? (
                <span
                  className={`${styles.resultBadge} ${answer.isCorrect ? styles.resultCorrect : styles.resultWrong}`}
                >
                  {answer.isCorrect ? "回答正确" : "回答错误"}
                </span>
              ) : (
                <span className={styles.resultPending}>未作答</span>
              )}
            </div>

            <h2 className={styles.questionTitle}>
              {problem.title || `题目 ${index + 1}`}
            </h2>
            <MarkdownRenderer
              content={problem.description || ""}
              className={styles.questionDesc}
            />

            {problem.options?.length > 0 && (
              <div className={styles.optionList}>
                {problem.options.map((option, optionIndex) => (
                  <div
                    key={`${index}-${optionIndex}`}
                    className={styles.optionItem}
                  >
                    <MarkdownRenderer
                      content={option}
                      className={styles.optionContent}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className={styles.answerGrid}>
              <div className={styles.answerBlock}>
                <div className={styles.blockTitle}>你的答案</div>
                <div className={styles.answerContent}>
                  {answer?.userAnswer ? (
                    problem.type === "code" ? (
                      <MarkdownRenderer
                        content={`\`\`\`${detail.language?.toLowerCase() || ""}\n${answer.userAnswer}\n\`\`\``}
                      />
                    ) : (
                      <MarkdownRenderer
                        content={answer.userAnswer}
                        className={styles.answerContent}
                      />
                    )
                  ) : (
                    <div className={styles.placeholder}>本题没有作答记录</div>
                  )}
                </div>
              </div>

              <div className={styles.answerBlock}>
                <div className={styles.blockTitle}>标准答案</div>
                <div className={styles.answerContent}>
                  {problem.type === "code" ? (
                    problem.solution ? (
                      <MarkdownRenderer
                        content={`\`\`\`${detail.language?.toLowerCase() || ""}\n${problem.solution}\n\`\`\``}
                      />
                    ) : (
                      <div className={styles.placeholder}>暂无参考代码</div>
                    )
                  ) : problem.answer ? (
                    <MarkdownRenderer
                      content={problem.answer}
                      className={styles.answerContent}
                    />
                  ) : (
                    <div className={styles.placeholder}>暂无标准答案</div>
                  )}
                </div>
              </div>
            </div>

            {answer?.aiFeedback?.feedback && (
              <div className={styles.feedbackBlock}>
                <div className={styles.blockTitle}>AI 讲评</div>
                <MarkdownRenderer
                  content={answer.aiFeedback.feedback}
                  className={styles.feedbackContent}
                />
              </div>
            )}

            {problem.explanation && (
              <div className={styles.feedbackBlock}>
                <div className={styles.blockTitle}>题目解析</div>
                <MarkdownRenderer
                  content={problem.explanation}
                  className={styles.feedbackContent}
                />
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  );
};

export default PracticeHistoryDetailPage;
