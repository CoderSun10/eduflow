/**
 * 数据库迁移脚本：修复 node_id 列类型 + 创建新增表
 *
 * 使用方式：node src/config/checkSchema.js
 */
import pg from "pg";
import { env } from "./env.js";

const c = new pg.Client({ connectionString: env.database.url });

const MIGRATION_SQL = `
-- 1. 修改 node_contents.node_id 从 UUID 为 VARCHAR(255)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'node_contents' AND column_name = 'node_id' AND data_type = 'uuid'
  ) THEN
    -- 先删除旧数据（UUID 无法转为字符串 node id）
    DELETE FROM node_contents;
    ALTER TABLE node_contents ALTER COLUMN node_id TYPE VARCHAR(255) USING node_id::text;
    RAISE NOTICE 'node_contents.node_id 已从 UUID 改为 VARCHAR(255)';
  ELSE
    RAISE NOTICE 'node_contents.node_id 已是 VARCHAR，跳过';
  END IF;
END $$;

-- 2. 修改 sessions.last_node_id 从 UUID 为 VARCHAR(255)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'last_node_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE sessions ALTER COLUMN last_node_id TYPE VARCHAR(255) USING last_node_id::text;
    RAISE NOTICE 'sessions.last_node_id 已从 UUID 改为 VARCHAR(255)';
  ELSE
    RAISE NOTICE 'sessions.last_node_id 已是 VARCHAR，跳过';
  END IF;
END $$;

-- 3. 创建缺失的新表
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

CREATE TABLE IF NOT EXISTS blueprint_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID UNIQUE NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sources       JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blueprint_sources_session ON blueprint_sources (session_id);

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

-- 4. 练习会话表（每次生成一组题目 = 一个 practice_session）
CREATE TABLE IF NOT EXISTS practice_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode          VARCHAR(20) NOT NULL CHECK (mode IN ('focused', 'comprehensive', 'project')),
  language      VARCHAR(64) NOT NULL,
  topics        JSONB NOT NULL DEFAULT '[]',
  difficulty    INTEGER NOT NULL CHECK (difficulty >= 1 AND difficulty <= 3),
  problems      JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practice_sessions_user ON practice_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_mode ON practice_sessions (user_id, mode);

-- 5. 练习作答记录表（每道题一条记录）
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
`;

async function main() {
  await c.connect();
  console.log("开始执行数据库迁移...");
  await c.query(MIGRATION_SQL);
  console.log("数据库迁移完成！");

  // 验证
  const r = await c.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'node_contents' AND column_name = 'node_id'",
  );
  console.log("node_contents.node_id 类型:", r.rows[0]?.data_type);

  const t = await c.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
  );
  console.log("所有表:", t.rows.map((r) => r.table_name).join(", "));
  await c.end();
}

main().catch((e) => {
  console.error("迁移失败:", e.message);
  process.exit(1);
});
