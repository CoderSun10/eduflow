# 语音识别功能设置说明

## 已完成的功能

### 后端

- ✅ 安装必要依赖：`multer`, `@alicloud/pop-core`, `alibabacloud-nls`
- ✅ 创建语音识别服务模块 `src/services/speechService.js`
- ✅ 创建语音识别控制器 `src/controllers/speechController.js`
- ✅ 创建语音识别路由 `src/routes/speechRoutes.js`
- ✅ 在主路由中注册语音识别路由

### 前端

- ✅ 创建语音识别 API `src/api/speechApi.js`
- ✅ 创建语音输入 Hook `src/hooks/useSpeechRecognition.js`
- ✅ 在 AI 助教聊天面板添加语音输入
- ✅ 在首页学习目标输入框添加语音输入
- ✅ 在学习地图页面添加语音输入

## 环境变量配置

确保以下环境变量已配置：

```bash
# 阿里云智能语音交互配置
ALIYUN_AK_ID=your_access_key_id
ALIYUN_AK_SECRET=your_access_key_secret
ALIYUN_NLS_APPKEY=your_nls_appkey
```

## 启动服务

### 后端

```bash
cd backend
npm start
# 或开发模式
npm run dev
```

### 前端

```bash
cd frontend
npm start
# 或开发模式
npm run dev
```

## API 端点

- `GET /api/speech/token` - 获取阿里云 Token（用于 WebSocket 直连）
- `POST /api/speech/recognize` - 一句话语音识别

## 测试

语音识别功能已通过静音测试，服务运行正常。

## 使用方法

1. 在任何输入框旁点击麦克风按钮
2. 允许浏览器访问麦克风
3. 开始说话
4. 再次点击停止录音
5. 语音识别结果会自动填充到输入框

## 注意事项

- 需要浏览器支持 MediaRecorder API
- 需要用户授权麦克风访问权限
- 音频会自动转换为 PCM 16bit 格式
- 支持最长 10MB 音频文件上传
