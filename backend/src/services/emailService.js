/**
 * 邮件发送服务
 * 
 * 使用 nodemailer 发送邮件，支持 SMTP 配置
 */
import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

// 创建邮件传输器
const createTransporter = () => {
  return nodemailer.createTransport({
    host: env.email.host,
    port: env.email.port,
    secure: env.email.secure,
    auth: {
      user: env.email.user,
      pass: env.email.pass,
    },
  });
};

/**
 * 发送密码重置邮件
 * @param {string} to - 收件人邮箱
 * @param {string} resetToken - 重置令牌
 * @param {string} frontendUrl - 前端地址
 */
export const sendPasswordResetEmail = async (to, resetToken, frontendUrl) => {
  const transporter = createTransporter();
  const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: `"EduFlow" <${env.email.user}>`,
    to,
    subject: "重置您的 EduFlow 密码",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
          .container { max-width: 500px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .logo { font-size: 24px; font-weight: bold; color: #6366f1; margin-bottom: 24px; }
          h1 { font-size: 20px; color: #333; margin-bottom: 16px; }
          p { color: #666; line-height: 1.6; margin-bottom: 16px; }
          .btn { display: inline-block; background: #6366f1; color: #fff !important; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 500; margin: 16px 0; }
          .btn:hover { background: #5558e3; }
          .note { font-size: 13px; color: #999; margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee; }
          .link { word-break: break-all; color: #6366f1; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">EduFlow</div>
          <h1>重置您的密码</h1>
          <p>您好，</p>
          <p>我们收到了您的密码重置请求。请点击下方按钮重置密码：</p>
          <a href="${resetUrl}" class="btn">重置密码</a>
          <p>如果按钮无法点击，请复制以下链接到浏览器：</p>
          <p class="link">${resetUrl}</p>
          <div class="note">
            <p>此链接将在 1 小时后失效。</p>
            <p>如果您没有请求重置密码，请忽略此邮件，您的密码不会被更改。</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info("密码重置邮件已发送", { to, messageId: info.messageId });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    logger.error("发送密码重置邮件失败", { to, err: err.message });
    throw new Error("邮件发送失败，请稍后重试");
  }
};

/**
 * 验证邮件服务配置
 */
export const verifyEmailConfig = async () => {
  if (!env.email.host || !env.email.user || !env.email.pass) {
    logger.warn("邮件服务未配置，密码重置功能将不可用");
    return false;
  }
  
  try {
    const transporter = createTransporter();
    await transporter.verify();
    logger.info("邮件服务配置验证成功");
    return true;
  } catch (err) {
    logger.error("邮件服务配置验证失败", { err: err.message });
    return false;
  }
};
