/**
 * 数据库初始化脚本
 *
 * 创建 eduflow 数据库（如不存在）并建表。
 *
 *   node src/config/initDb.js          # 初始化（保留已有数据）
 *   node src/config/initDb.js --reset  # 删除已有数据库再重建
 */
import pg from "pg";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

const { Client } = pg;

const DB_NAME = "eduflow";

const CREATE_TABLES_SQL = `
-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  username      VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  learning_focus VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- 学习会话表
CREATE TABLE IF NOT EXISTS sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         VARCHAR(255) NOT NULL,
  language      VARCHAR(64) NOT NULL,
  intent        TEXT NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  progress      INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  last_node_id  UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status  ON sessions (status);

-- 知识蓝图表
CREATE TABLE IF NOT EXISTS blueprints (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID UNIQUE NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  tiers         JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blueprints_session_id ON blueprints (session_id);

-- AI 生成的节点学习内容缓存表
CREATE TABLE IF NOT EXISTS node_contents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  node_id       VARCHAR(255) NOT NULL,
  content       JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_node_contents_session_node ON node_contents (session_id, node_id);

-- AI 对话历史表
CREATE TABLE IF NOT EXISTS chat_histories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  node_id       VARCHAR(255),
  messages      JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_histories_session ON chat_histories (session_id);
CREATE INDEX IF NOT EXISTS idx_chat_histories_session_node ON chat_histories (session_id, node_id);

-- 代码评价历史表
CREATE TABLE IF NOT EXISTS code_reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  node_id       VARCHAR(255),
  code          TEXT NOT NULL,
  exercise_title VARCHAR(255),
  review        JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_code_reviews_session ON code_reviews (session_id);
CREATE INDEX IF NOT EXISTS idx_code_reviews_session_node ON code_reviews (session_id, node_id);

-- 蓝图搜索来源表
CREATE TABLE IF NOT EXISTS blueprint_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID UNIQUE NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sources       JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blueprint_sources_session ON blueprint_sources (session_id);

-- 学习地图表（保存用户生成过的长期学习路线，便于回看与继续规划）
CREATE TABLE IF NOT EXISTS learning_maps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal          TEXT NOT NULL,
  title         VARCHAR(255) NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_maps_user ON learning_maps (user_id, updated_at DESC);

-- 练习会话表
CREATE TABLE IF NOT EXISTS practice_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode          VARCHAR(20) NOT NULL CHECK (mode IN ('focused', 'comprehensive', 'project')),
  language      VARCHAR(64) NOT NULL,
  topics        JSONB NOT NULL DEFAULT '[]',
  difficulty    INTEGER NOT NULL DEFAULT 0 CHECK (difficulty >= 0 AND difficulty <= 3),
  problems      JSONB NOT NULL DEFAULT '[]',
  source_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  atomic_node_id VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practice_sessions_user ON practice_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_mode ON practice_sessions (user_id, mode);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_atomic ON practice_sessions (source_session_id, atomic_node_id);

-- 练习作答记录表
CREATE TABLE IF NOT EXISTS practice_answers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_session_id UUID NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  problem_index     INTEGER NOT NULL,
  user_answer       TEXT,
  is_correct        BOOLEAN,
  ai_feedback       JSONB NOT NULL DEFAULT '{}',
  is_wrong_note     BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practice_answers_session ON practice_answers (practice_session_id);
CREATE INDEX IF NOT EXISTS idx_practice_answers_wrong ON practice_answers (practice_session_id) WHERE is_correct = false;

-- 题库（每道题独立持久化，方便检索 / 复用）
CREATE TABLE IF NOT EXISTS practice_questions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_session_id UUID NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  problem_index     INTEGER NOT NULL,
  type              VARCHAR(20) NOT NULL,
  title             VARCHAR(255),
  description       TEXT,
  difficulty        INTEGER,
  tags              JSONB NOT NULL DEFAULT '[]',
  options           JSONB,
  correct_answer    TEXT,
  starter_code      TEXT,
  solution          TEXT,
  explanation       TEXT,
  payload           JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(practice_session_id, problem_index)
);

CREATE INDEX IF NOT EXISTS idx_practice_questions_session ON practice_questions (practice_session_id);
CREATE INDEX IF NOT EXISTS idx_practice_questions_type ON practice_questions (type);

-- 错题集（独立表，包含详细错误信息和 AI 纠错文本）
CREATE TABLE IF NOT EXISTS wrong_notes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  practice_session_id UUID NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  practice_answer_id UUID REFERENCES practice_answers(id) ON DELETE CASCADE,
  problem_index     INTEGER NOT NULL,
  problem_snapshot  JSONB NOT NULL DEFAULT '{}',
  user_answer       TEXT,
  correct_answer    TEXT,
  ai_correction     TEXT,
  ai_feedback       JSONB NOT NULL DEFAULT '{}',
  tags              JSONB NOT NULL DEFAULT '[]',
  reviewed          BOOLEAN NOT NULL DEFAULT false,
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wrong_notes_user ON wrong_notes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wrong_notes_session ON wrong_notes (practice_session_id);
CREATE INDEX IF NOT EXISTS idx_wrong_notes_unreviewed ON wrong_notes (user_id) WHERE reviewed = false;

-- AI 纠错日志（追加式，记录每次 AI 给出的解析 / 纠错文本，可用于复盘与统计）
CREATE TABLE IF NOT EXISTS ai_corrections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  practice_session_id UUID REFERENCES practice_sessions(id) ON DELETE SET NULL,
  source_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  scope             VARCHAR(40) NOT NULL,
  reference_id      VARCHAR(255),
  request           JSONB NOT NULL DEFAULT '{}',
  response          JSONB NOT NULL DEFAULT '{}',
  text              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_corrections_user ON ai_corrections (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_corrections_scope ON ai_corrections (scope, created_at DESC);

-- 生成进度追踪（蓝图 + 节点内容 + 原子练习 预生成的状态）
CREATE TABLE IF NOT EXISTS generation_progress (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  scope             VARCHAR(40) NOT NULL,
  reference_id      VARCHAR(255) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'running', 'done', 'failed')),
  detail            JSONB NOT NULL DEFAULT '{}',
  error             TEXT,
  started_at        TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, scope, reference_id)
);

CREATE INDEX IF NOT EXISTS idx_generation_progress_session ON generation_progress (session_id);
CREATE INDEX IF NOT EXISTS idx_generation_progress_status ON generation_progress (session_id, status);

-- 密码重置令牌表
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token         VARCHAR(255) UNIQUE NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  used          BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens (token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens (user_id);
`;

async function dropDatabase() {
  const adminUrl = env.database.url.replace(/\/[^/]*$/, "/postgres");
  const client = new Client({ connectionString: adminUrl });
  try {
    await client.connect();
    // 终止所有连接以便能 DROP
    await client.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [DB_NAME],
    );
    await client.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);
    logger.info(`数据库 ${DB_NAME} 已删除`);
  } finally {
    await client.end();
  }
}

async function ensureDatabase() {
  const adminUrl = env.database.url.replace(/\/[^/]*$/, "/postgres");
  const client = new Client({ connectionString: adminUrl });
  try {
    await client.connect();
    const res = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [DB_NAME],
    );
    if (res.rowCount === 0) {
      await client.query(`CREATE DATABASE ${DB_NAME}`);
      logger.info(`数据库 ${DB_NAME} 已创建`);
    } else {
      logger.info(`数据库 ${DB_NAME} 已存在`);
    }
  } finally {
    await client.end();
  }
}

async function createTables() {
  const client = new Client({ connectionString: env.database.url });
  try {
    await client.connect();
    await client.query(CREATE_TABLES_SQL);
    logger.info("所有表已创建 / 已存在");
  } finally {
    await client.end();
  }
}

async function main() {
  const reset = process.argv.includes("--reset");
  try {
    if (reset) {
      logger.warn("⚠️  --reset 模式：将删除并重建数据库");
      await dropDatabase();
    }
    await ensureDatabase();
    await createTables();
    logger.info("数据库初始化完成");
    process.exit(0);
  } catch (err) {
    logger.error("数据库初始化失败", { err: err.message, stack: err.stack });
    process.exit(1);
  }
}

main();
