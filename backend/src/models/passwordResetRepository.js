/**
 * 密码重置令牌数据访问层
 */
import { query } from "../config/database.js";
import crypto from "crypto";

/**
 * 生成随机令牌
 */
const generateToken = () => crypto.randomBytes(32).toString("hex");

/**
 * 创建密码重置令牌
 * @param {string} userId - 用户ID
 * @param {number} expiresInMinutes - 过期时间（分钟）
 */
export const createResetToken = async (userId, expiresInMinutes = 60) => {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  // 先使该用户之前的所有未使用令牌失效
  await query(
    `UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false`,
    [userId]
  );

  // 创建新令牌
  const { rows } = await query(
    `INSERT INTO password_reset_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id, token, expires_at`,
    [userId, token, expiresAt]
  );

  return rows[0];
};

/**
 * 验证令牌并返回用户信息
 * @param {string} token - 重置令牌
 */
export const verifyToken = async (token) => {
  const { rows } = await query(
    `SELECT prt.id, prt.user_id, prt.expires_at, prt.used, u.email, u.username
     FROM password_reset_tokens prt
     JOIN users u ON u.id = prt.user_id
     WHERE prt.token = $1`,
    [token]
  );

  if (rows.length === 0) {
    return { valid: false, error: "无效的重置链接" };
  }

  const record = rows[0];

  if (record.used) {
    return { valid: false, error: "该链接已被使用" };
  }

  if (new Date(record.expires_at) < new Date()) {
    return { valid: false, error: "该链接已过期，请重新申请" };
  }

  return {
    valid: true,
    tokenId: record.id,
    userId: record.user_id,
    email: record.email,
    username: record.username,
  };
};

/**
 * 标记令牌为已使用
 * @param {string} tokenId - 令牌ID
 */
export const markTokenUsed = async (tokenId) => {
  await query(
    `UPDATE password_reset_tokens SET used = true WHERE id = $1`,
    [tokenId]
  );
};

/**
 * 清理过期令牌
 */
export const cleanExpiredTokens = async () => {
  const { rowCount } = await query(
    `DELETE FROM password_reset_tokens WHERE expires_at < NOW() OR used = true`
  );
  return rowCount;
};
