import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import MarkdownRenderer from "../../components/common/MarkdownRenderer.jsx";
import {
  useWrongNotes,
  useRetryWrongNote,
  useMarkWrongNoteReviewed,
} from "../../hooks/usePractice.js";
import { RoutePaths } from "../../constants/routes.js";
import styles from "./PracticeWrongNotesPage.module.css";

const TYPE_LABEL = {
  choice: "选择题",
  fill: "填空题",
  code: "代码实操",
};

const formatDateTime = (value) => {
  if (!value) return "刚刚";
  return new Date(value).toLocaleString();
};

const buildPromptPlaceholder = (type) => {
  if (type === "code") return "在这里重新写下你的解法或代码…";
  if (type === "fill") return "在这里重新填写你的答案…";
  return "在这里重新写下你的答案与思路…";
};

const getProblemTitle = (note, index) => {
  return note.problemSnapshot?.title || `错题 ${index + 1}`;
};

const PracticeWrongNotesPage = () => {
  const navigate = useNavigate();
  const { wrongNotes, isLoading, error } = useWrongNotes();
  const retryMutation = useRetryWrongNote();
  const reviewedMutation = useMarkWrongNoteReviewed();
  const [drafts, setDrafts] = useState({});
  const [expandedIds, setExpandedIds] = useState({});
  const [localRetries, setLocalRetries] = useState({});

  const notes = useMemo(
    () =>
      (wrongNotes ?? []).map((note) => ({
        ...note,
        retryHistory: [
          ...(localRetries[note.id] ?? []),
          ...(note.retryHistory ?? []),
        ],
      })),
    [wrongNotes, localRetries],
  );

  const setDraft = (id, value) => {
    setDrafts((prev) => ({ ...prev, [id]: value }));
  };

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRetry = async (note) => {
    const value = drafts[note.id]?.trim();
    if (!value) return;
    try {
      const result = await retryMutation.mutateAsync({
        id: note.id,
        userAnswer: value,
      });
      setLocalRetries((prev) => ({
        ...prev,
        [note.id]: [result.retry, ...(prev[note.id] ?? [])],
      }));
      setExpandedIds((prev) => ({ ...prev, [note.id]: true }));
      setDraft(note.id, "");
    } catch {
      /* noop */
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.topRow}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => navigate(RoutePaths.PRACTICE)}
        >
          返回练习中心
        </button>
        <div className={styles.topMeta}>共 {notes.length} 道长期保留的错题</div>
      </div>

      <header className={styles.header}>
        <h1 className={styles.title}>错题集</h1>
        <p className={styles.subtitle}>
          所有答错过的题都会长期保留在这里。你可以随时回看原题、重新作答，并再次让
          AI 评估。
        </p>
      </header>

      {isLoading ? (
        <div className={styles.stateBox}>正在加载错题集…</div>
      ) : error ? (
        <div className={styles.stateBox}>
          {error.message || "错题集加载失败"}
        </div>
      ) : notes.length === 0 ? (
        <div className={styles.emptyBox}>
          <div className={styles.emptyTitle}>当前还没有错题</div>
          <div className={styles.emptyText}>
            去做几组练习后，这里会自动沉淀你的错题记录。
          </div>
        </div>
      ) : (
        <div className={styles.list}>
          {notes.map((note, index) => {
            const snapshot = note.problemSnapshot ?? {};
            const retryHistory = note.retryHistory ?? [];
            const latestRetry = retryHistory[0]?.response ?? null;
            const inputType = snapshot.type ?? "choice";
            const isExpanded = !!expandedIds[note.id];
            const isBusy =
              retryMutation.isPending || reviewedMutation.isPending;

            return (
              <section key={note.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.headerMain}>
                    <div className={styles.badgeRow}>
                      <span className={styles.typeBadge}>
                        {TYPE_LABEL[inputType] || inputType}
                      </span>
                      {!!note.tags?.length && (
                        <span className={styles.tags}>
                          {note.tags.join(" · ")}
                        </span>
                      )}
                      <span className={styles.time}>
                        {formatDateTime(note.createdAt)}
                      </span>
                    </div>
                    <h2 className={styles.cardTitle}>
                      {getProblemTitle(note, index)}
                    </h2>
                  </div>
                  <div className={styles.headerActions}>
                    <button
                      type="button"
                      className={styles.ghostBtn}
                      onClick={() => toggleExpanded(note.id)}
                    >
                      {isExpanded
                        ? "收起重做记录"
                        : `查看重做记录（${retryHistory.length}）`}
                    </button>
                    {!note.reviewed && (
                      <button
                        type="button"
                        className={styles.ghostBtn}
                        disabled={isBusy}
                        onClick={() => reviewedMutation.mutate(note.id)}
                      >
                        标记已复习
                      </button>
                    )}
                  </div>
                </div>

                <div className={styles.problemBlock}>
                  <div className={styles.blockTitle}>原题内容</div>
                  <MarkdownRenderer
                    content={
                      snapshot.description || snapshot.title || "暂无题目描述"
                    }
                    className={styles.markdown}
                  />
                  {snapshot.options?.length > 0 && (
                    <div className={styles.optionList}>
                      {snapshot.options.map((option, optionIndex) => (
                        <div
                          key={`${note.id}-${optionIndex}`}
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
                </div>

                <div className={styles.grid}>
                  <div className={styles.infoCard}>
                    <div className={styles.blockTitle}>第一次答错时的答案</div>
                    <MarkdownRenderer
                      content={note.userAnswer || "未记录用户答案"}
                      className={styles.markdown}
                    />
                  </div>
                  <div className={styles.infoCard}>
                    <div className={styles.blockTitle}>标准答案 / 参考解</div>
                    <MarkdownRenderer
                      content={
                        note.correctAnswer ||
                        snapshot.correctAnswer ||
                        snapshot.answer ||
                        snapshot.solution ||
                        "暂无标准答案"
                      }
                      className={styles.markdown}
                    />
                  </div>
                </div>

                <div className={styles.feedbackCard}>
                  <div className={styles.blockTitle}>首次 AI 讲评</div>
                  <MarkdownRenderer
                    content={
                      note.aiCorrection ||
                      note.aiFeedback?.feedback ||
                      "暂无 AI 讲评"
                    }
                    className={styles.markdown}
                  />
                </div>

                <div className={styles.retryCard}>
                  <div className={styles.retryHeader}>
                    <div>
                      <div className={styles.blockTitle}>重新作答</div>
                      <div className={styles.retryHint}>
                        这道错题会一直保留在错题集里，后续每次重做都会累计记录。
                      </div>
                    </div>
                    {latestRetry && (
                      <div
                        className={`${styles.retryStatus} ${latestRetry.isCorrect ? styles.retryCorrect : styles.retryWrong}`}
                      >
                        最近一次重做：
                        {latestRetry.isCorrect ? "已做对" : "仍有问题"}
                      </div>
                    )}
                  </div>

                  <textarea
                    className={styles.retryInput}
                    value={drafts[note.id] ?? ""}
                    onChange={(e) => setDraft(note.id, e.target.value)}
                    placeholder={buildPromptPlaceholder(inputType)}
                    spellCheck={false}
                  />

                  <div className={styles.retryActions}>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      disabled={
                        !drafts[note.id]?.trim() || retryMutation.isPending
                      }
                      onClick={() => handleRetry(note)}
                    >
                      {retryMutation.isPending
                        ? "AI 评估中…"
                        : "重新提交并再次 AI 评估"}
                    </button>
                  </div>
                </div>

                {isExpanded && retryHistory.length > 0 && (
                  <div className={styles.retryHistory}>
                    <div className={styles.blockTitle}>重做记录</div>
                    <div className={styles.retryList}>
                      {retryHistory.map((retry) => (
                        <div key={retry.id} className={styles.retryItem}>
                          <div className={styles.retryMeta}>
                            <span>{formatDateTime(retry.createdAt)}</span>
                            <span
                              className={`${styles.retryPill} ${retry.response?.isCorrect ? styles.retryCorrect : styles.retryWrong}`}
                            >
                              {retry.response?.isCorrect
                                ? "本次正确"
                                : "本次仍错"}
                            </span>
                          </div>
                          <div className={styles.retrySection}>
                            <div className={styles.smallTitle}>
                              你的重做答案
                            </div>
                            <MarkdownRenderer
                              content={retry.request?.userAnswer || "未记录"}
                              className={styles.markdown}
                            />
                          </div>
                          <div className={styles.retrySection}>
                            <div className={styles.smallTitle}>AI 再次评估</div>
                            <MarkdownRenderer
                              content={
                                retry.response?.feedback ||
                                retry.text ||
                                "暂无反馈"
                              }
                              className={styles.markdown}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PracticeWrongNotesPage;
