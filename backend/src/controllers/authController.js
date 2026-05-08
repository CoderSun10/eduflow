/**
 * 认证控制器
 *
 * 职责：HTTP 适配层 —— 从 req 提参数、调用 service、用统一 response 返回。
 * 所有处理器使用 asyncHandler 包装，错误自动进入全局 errorHandler。
 */
import * as authService from "../services/authService.js";
import { success } from "../utils/response.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  res.status(201).json(success(result, "注册成功"));
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.json(success(result, "登录成功"));
});

export const me = asyncHandler(async (req, res) => {
  const profile = await authService.getProfile(req.user.sub);
  res.json(success(profile));
});

export const updateProfile = asyncHandler(async (req, res) => {
  const updated = await authService.updateProfile(req.user.sub, req.body);
  res.json(success(updated, "资料已更新"));
});

export const changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changePassword(req.user.sub, req.body);
  res.json(success(result, "密码修改成功"));
});

export const deleteAllUserData = asyncHandler(async (req, res) => {
  const result = await authService.deleteAllUserData(req.user.sub);
  res.json(success(result, "所有数据已删除"));
});

export const requestPasswordReset = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const result = await authService.requestPasswordReset(email);
  res.json(success(result));
});

export const verifyResetToken = asyncHandler(async (req, res) => {
  const { token } = req.query;
  const result = await authService.verifyResetToken(token);
  res.json(success(result));
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const result = await authService.resetPassword(token, password);
  res.json(success(result, "密码重置成功"));
});
