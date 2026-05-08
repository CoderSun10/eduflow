/**
 * 临时迁移脚本：更新 practice_sessions 表的 difficulty 约束
 */
import { query } from './config/database.js';

async function migrate() {
  try {
    // 删除旧约束
    await query('ALTER TABLE practice_sessions DROP CONSTRAINT IF EXISTS practice_sessions_difficulty_check');
    console.log('已删除旧约束');

    // 添加新约束（允许 difficulty=0）
    await query('ALTER TABLE practice_sessions ADD CONSTRAINT practice_sessions_difficulty_check CHECK (difficulty >= 0 AND difficulty <= 3)');
    console.log('已添加新约束，允许 difficulty=0');

    console.log('迁移完成');
    process.exit(0);
  } catch (err) {
    console.error('迁移失败', err);
    process.exit(1);
  }
}

migrate();
