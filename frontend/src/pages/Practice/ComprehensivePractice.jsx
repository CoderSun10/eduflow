/**
 * 综合练习 — 只选科目，AI 根据进度自动组合知识点出题
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

const ComprehensivePractice = () => {
  const navigate = useNavigate();
  const { subjects, isLoading } = useSubjects();
  const generateMutation = useGeneratePractice();

  const [selectedSubject, setSelectedSubject] = useState(null);
  const [examData, setExamData] = useState(null);

  const currentSubject = subjects.find((s) => s.sessionId === selectedSubject);

  const handleGenerate = async () => {
    if (!currentSubject) return;
    try {
      const result = await generateMutation.mutateAsync({
        sessionIds: [currentSubject.sessionId],
        mode: "comprehensive",
      });
      setExamData({
        problems: result.problems ?? [],
        practiceSessionId: result.practiceSessionId,
        language: currentSubject.language,
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
        <h1 className={styles.title}>综合练习</h1>
        <p className={styles.subtitle}>
          选择学习科目，AI 将根据你的学习进度自动组合知识点，生成综合性练习题
        </p>
      </header>

      {/* 科目 */}
      <div className={styles.section}>
        <div className={styles.sectionTitleRow}>
          <span className={styles.sectionTitle}>选择学习科目</span>
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
                className={`${styles.subjectChip} ${selectedSubject === s.sessionId ? styles.subjectActive : ""}`}
                onClick={() => setSelectedSubject(s.sessionId)}
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

      {/* 生成 */}
      <button
        type="button"
        className={styles.generateBtn}
        disabled={!currentSubject || generateMutation.isPending}
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
            生成综合练习题
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
            AI 正在根据学习进度组合知识点出题…
          </div>
        </div>
      )}
    </div>
  );
};

export default ComprehensivePractice;
