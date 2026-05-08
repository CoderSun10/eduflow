/**
 * 认证业务逻辑（Service 层）
 *
 * 职责：编排 repository + 工具函数完成"业务用例"，
 * 不感知 HTTP（不读 req / res），只接收纯参数、返回纯数据或抛 AppError。
 * 这样未来若改用 GraphQL / gRPC，只需替换 controller，service 不动。
 */
import * as userRepository from "../models/userRepository.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { signAccessToken, signRefreshToken } from "../utils/jwt.js";
import { AppError } from "../utils/AppError.js";
import { ErrorCodes } from "../constants/errorCodes.js";

const toPublicUser = (user) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  learningFocus: user.learningFocus,
  createdAt: user.createdAt,
});

const issueTokens = (user) => {
  const payload = { sub: user.id, email: user.email };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
};

export const register = async ({
  email,
  username,
  password,
  learningFocus,
}) => {
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw new AppError({
      code: ErrorCodes.USER_ALREADY_EXISTS,
      message: "该邮箱已被注册",
      status: 409,
    });
  }

  const passwordHash = await hashPassword(password);
  const user = await userRepository.create({
    email,
    username,
    passwordHash,
    learningFocus,
  });

  return {
    user: toPublicUser(user),
    ...issueTokens(user),
  };
};

export const login = async ({ email, password }) => {
  const user = await userRepository.findByEmail(email);
  if (!user) {
    throw new AppError({
      code: ErrorCodes.CREDENTIALS_INVALID,
      message: "邮箱或密码错误",
      status: 401,
    });
  }

  const matched = await comparePassword(password, user.passwordHash);
  if (!matched) {
    throw new AppError({
      code: ErrorCodes.CREDENTIALS_INVALID,
      message: "邮箱或密码错误",
      status: 401,
    });
  }

  return {
    user: toPublicUser(user),
    ...issueTokens(user),
  };
};

export const getProfile = async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AppError({
      code: ErrorCodes.USER_NOT_FOUND,
      message: "用户不存在",
      status: 404,
    });
  }
  return toPublicUser(user);
};

export const updateProfile = async (userId, { username }) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AppError({
      code: ErrorCodes.USER_NOT_FOUND,
      message: "用户不存在",
      status: 404,
    });
  }
  const updated = await userRepository.update(userId, { username });
  return toPublicUser(updated);
};

export const changePassword = async (
  userId,
  { currentPassword, newPassword },
) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AppError({
      code: ErrorCodes.USER_NOT_FOUND,
      message: "用户不存在",
      status: 404,
    });
  }
  const matched = await comparePassword(currentPassword, user.passwordHash);
  if (!matched) {
    throw new AppError({
      code: ErrorCodes.CREDENTIALS_INVALID,
      message: "当前密码错误",
      status: 401,
    });
  }
  if (newPassword.length < 8) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: "新密码至少 8 位",
      status: 400,
    });
  }
  const passwordHash = await hashPassword(newPassword);
  await userRepository.update(userId, { passwordHash });
  return { message: "密码修改成功" };
};

export const deleteAllUserData = async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AppError({
      code: ErrorCodes.USER_NOT_FOUND,
      message: "用户不存在",
      status: 404,
    });
  }

  // 删除用户所有数据
  await userRepository.deleteAllUserData(userId);
  return { message: "所有数据已删除" };
};

/**
 * 请求密码重置（发送邮件）
 */
export const requestPasswordReset = async (email) => {
  const user = await userRepository.findByEmail(email);

  // 即使用户不存在也返回成功（防止邮箱探测）
  if (!user) {
    return { message: "如果该邮箱已注册，您将收到重置密码邮件" };
  }

  // 动态导入避免循环依赖
  const { createResetToken } =
    await import("../models/passwordResetRepository.js");
  const { sendPasswordResetEmail } = await import("./emailService.js");
  const { env } = await import("../config/env.js");

  // 创建重置令牌
  const tokenRecord = await createResetToken(user.id);

  // 发送邮件
  await sendPasswordResetEmail(email, tokenRecord.token, env.frontendUrl);

  return { message: "重置密码邮件已发送，请查收" };
};

/**
 * 验证重置令牌
 */
export const verifyResetToken = async (token) => {
  const { verifyToken } = await import("../models/passwordResetRepository.js");
  return verifyToken(token);
};

/**
 * 重置密码
 */
export const resetPassword = async (token, newPassword) => {
  if (!newPassword || newPassword.length < 8) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: "新密码至少 8 位",
      status: 400,
    });
  }

  const { verifyToken, markTokenUsed } =
    await import("../models/passwordResetRepository.js");

  // 验证令牌
  const result = await verifyToken(token);
  if (!result.valid) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: result.error,
      status: 400,
    });
  }

  // 更新密码
  const passwordHash = await hashPassword(newPassword);
  await userRepository.update(result.userId, { passwordHash });

  // 标记令牌已使用
  await markTokenUsed(result.tokenId);

  return { message: "密码重置成功" };
};
