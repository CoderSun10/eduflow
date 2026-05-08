/**
 * 题库持久化 Repository
 *
 * 每道 AI 生成的练习题独立持久化到 practice_questions，
 * 与 practice_sessions.problems(JSONB) 双写：JSONB 用于一次性读取整组题，
 * practice_questions 用于按题查询、复用、统计。
 */
import { query } from "../config/database.js";

const toRow = (r) =>
  r
    ? {
        id: r.id,
        practiceSessionId: r.practice_session_id,
        problemIndex: r.problem_index,
        type: r.type,
        title: r.title,
        description: r.description,
        difficulty: r.difficulty,
        tags: r.tags,
        options: r.options,
        correctAnswer: r.correct_answer,
        starterCode: r.starter_code,
        solution: r.solution,
        explanation: r.explanation,
        payload: r.payload,
        createdAt: r.created_at,
      }
    : null;

export const upsertProblems = async (practiceSessionId, problems) => {
  if (!problems?.length) return [];
  const out = [];
  for (let i = 0; i < problems.length; i++) {
    const p = problems[i];
    const correctAnswer =
      p.type === "code" ? p.solution ?? null : p.answer ?? null;
    const { rows } = await query(
      `INSERT INTO practice_questions
        (practice_session_id, problem_index, type, title, description,
         difficulty, tags, options, correct_answer, starter_code, solution,
         explanation, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (practice_session_id, problem_index)
       DO UPDATE SET
         type = EXCLUDED.type,
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         difficulty = EXCLUDED.difficulty,
         tags = EXCLUDED.tags,
         options = EXCLUDED.options,
         correct_answer = EXCLUDED.correct_answer,
         starter_code = EXCLUDED.starter_code,
         solution = EXCLUDED.solution,
         explanation = EXCLUDED.explanation,
         payload = EXCLUDED.payload
       RETURNING *`,
      [
        practiceSessionId,
        i,
        p.type ?? "choice",
        p.title ?? null,
        p.description ?? null,
        p.difficulty ?? null,
        JSON.stringify(p.tags ?? []),
        p.options ? JSON.stringify(p.options) : null,
        correctAnswer,
        p.starterCode ?? null,
        p.solution ?? null,
        p.explanation ?? null,
        JSON.stringify(p),
      ],
    );
    out.push(toRow(rows[0]));
  }
  return out;
};

export const findBySession = async (practiceSessionId) => {
  const { rows } = await query(
    `SELECT * FROM practice_questions WHERE practice_session_id = $1 ORDER BY problem_index`,
    [practiceSessionId],
  );
  return rows.map(toRow);
};

export const findByIndex = async (practiceSessionId, problemIndex) => {
  const { rows } = await query(
    `SELECT * FROM practice_questions
     WHERE practice_session_id = $1 AND problem_index = $2`,
    [practiceSessionId, problemIndex],
  );
  return toRow(rows[0]);
};
