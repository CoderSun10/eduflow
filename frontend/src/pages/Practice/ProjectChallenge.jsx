/**
 * 项目挑战 — 多科目选择 + 难度，生成 1 道代码实操题
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSubjects, useGeneratePractice } from "../../hooks/usePractice.js";
import {
  getSessionDisplaySubtitle,
  getSessionDisplayTitle,
} from "../../utils/sessionDisplay.js";
import PracticeExam from "./PracticeExam.jsx";
import styles from "./PracticeSetup.module.css";

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

const ProjectChallenge = () => {
  const navigate = useNavigate();
  const { subjects, isLoading } = useSubjects();
  const generateMutation = useGeneratePractice();

  const [selectedIds, setSelectedIds] = useState([]);
  const [difficulty, setDifficulty] = useState(2);
  const [examData, setExamData] = useState(null);

  const toggleSubject = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectedSubjects = subjects.filter((s) =>
    selectedIds.includes(s.sessionId),
  );

  const handleGenerate = async () => {
    if (selectedIds.length === 0) return;
    try {
      const result = await generateMutation.mutateAsync({
        sessionIds: selectedIds,
        mode: "project",
        difficulty,
      });
      const lang = selectedSubjects.map((s) => s.language).join(" + ");
      setExamData({
        problems: result.problems ?? [],
        practiceSessionId: result.practiceSessionId,
        language: lang,
      });
    } catch {
      /* handled by mutation */
    }
  };

  if (examData?.problems?.length > 0) {
    return (
      <div className={styles.page}>
        <div className={styles.backRow}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => setExamData(null)}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            重新选题
          </button>
        </div>
        <PracticeExam
          problems={examData.problems}
          practiceSessionId={examData.practiceSessionId}
          language={examData.language}
          allowUpload={true}
        />
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
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          返回
        </button>
      </div>

      <header className={styles.header}>
        <h1 className={styles.title}>项目挑战</h1>
        <p className={styles.subtitle}>
          选择一个或多个学习科目，AI 将综合所有已学知识生成一道高质量代码项目题
        </p>
      </header>

      {/* 科目（多选） */}
      <div className={styles.section}>
        <div className={styles.sectionTitleRow}>
          <span className={styles.sectionTitle}>选择学习科目（可多选）</span>
        </div>
        {isLoading ? (
          <div className={styles.empty}>加载中…</div>
        ) : subjects.length === 0 ? (
          <div className={styles.empty}>
            还没有学习记录，先从主页创建学习会话吧
          </div>
        ) : (
          <div className={styles.subjectList}>
            {subjects.map((s) => (
              <button
                key={s.sessionId}
                type="button"
                className={`${styles.subjectChip} ${selectedIds.includes(s.sessionId) ? styles.subjectActive : ""}`}
                onClick={() => toggleSubject(s.sessionId)}
              >
                <span className={styles.subjectCopy}>
                  <span className={styles.subjectName}>
                    {getSessionDisplayTitle(s)}
                  </span>
                  <span className={styles.subjectSubtitle}>
                    {getSessionDisplaySubtitle(s)}
                  </span>
                </span>
                <span className={styles.subjectPct}>{s.progress}%</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 难度 */}
      <div className={styles.section}>
        <div className={styles.sectionTitleRow}>
          <span className={styles.sectionTitle}>难度等级</span>
        </div>
        <div className={styles.diffRow}>
          {[1, 2, 3].map((d) => (
            <button
              key={d}
              type="button"
              className={`${styles.diffBtn} ${difficulty === d ? styles.diffActive : ""}`}
              onClick={() => setDifficulty(d)}
            >
              <Stars count={d} />
              <span className={styles.diffLabel}>
                {d === 1 ? "简单" : d === 2 ? "中等" : "困难"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 生成 */}
      <button
        type="button"
        className={styles.generateBtn}
        disabled={selectedIds.length === 0 || generateMutation.isPending}
        onClick={handleGenerate}
      >
        {generateMutation.isPending ? (
          <>
            <span className={styles.spinner} /> AI 正在出题…
          </>
        ) : (
          <>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            生成项目挑战题
          </>
        )}
      </button>

      {generateMutation.isPending && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingIcon}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div className={styles.loadingText}>
            AI 正在综合多学科知识生成项目挑战…
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectChallenge;
