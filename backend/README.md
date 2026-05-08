# EduFlow 后端

EduFlow AI v1.0 的 Node.js 后端服务，承担用户认证、学习会话编排、AI 教学与对外 API 网关职责。
通过 DeepSeek API（OpenAI 兼容格式）提供 AI 能力：知识蓝图生成、节点内容生成、苏格拉底式对话、代码评价。

## 目录结构

```
backend/
├── src/
│   ├── config/         # 环境变量装载、运行时配置
│   ├── constants/      # 错误码、枚举等常量
│   ├── controllers/    # HTTP 适配层：解析 req / 返回 res
│   ├── services/       # 业务用例编排，纯函数式参数 / 返回值
│   ├── models/         # 数据访问层（Repository），可替换实现
│   ├── routes/         # 路由编排：路径 → 中间件 → controller
│   ├── middlewares/    # 鉴权、校验、限流、错误处理
│   ├── validators/     # zod schema，集中维护
│   ├── utils/          # JWT、密码、日志、AppError 等通用工具
│   ├── app.js          # Express 装配（不监听端口）
│   └── server.js       # 进程入口与优雅关闭
├── .env.example        # 环境变量样例
├── .gitignore
└── package.json
```

## 分层约定

| 层级       | 职责                                           | 禁止             |
| ---------- | ---------------------------------------------- | ---------------- |
| controller | 读 `req`、调 service、用 `success/fail` 返回   | 写业务逻辑       |
| service    | 业务编排、事务边界、调用 repository / 外部服务 | 触碰 `req`/`res` |
| repository | 数据持久化（PostgreSQL + node-pg）             | 业务规则判断     |
| middleware | 横切关注点：鉴权、限流、校验、错误兜底         | 含具体业务       |

## 启动

```bash
cp .env.example .env       # 修改 JWT_SECRET、DATABASE_URL 等配置
npm install
npm run db:init             # 初始化 PostgreSQL 数据库和表
npm run dev                # 开发模式（node --watch 热重载）
```

> **前提**：本地需运行 PostgreSQL，默认连接 `postgresql://postgres:123456@localhost:5432/eduflow`。
> `npm run db:init` 会自动创建数据库和所有表。

## 数据库实际使用方案

以后只认下面这套流程，不要混用多个脚本：

```bash
npm run db:init    # 日常使用：自动创建数据库 / 补齐缺失表
npm run db:reset   # 需要彻底清库重建时使用
npm run db:migrate # 目前与 db:init 等价，保留给习惯使用 migrate 命令的人
```

### 权威文件

- `src/config/database.js`
  - 运行时唯一数据库连接池入口
- `src/config/initDb.js`
  - 当前唯一权威的数据库初始化 / 补表脚本

### 现阶段不要作为日常入口的历史脚本

- `src/config/checkSchema.js`
- `src/migrate.js`

这两个文件属于历史补丁脚本，保留仅用于追溯旧问题；**日常开发、联调、部署时不要优先运行它们**，避免再次出现“到底该跑哪个脚本”的混乱。

### 推荐操作顺序

1. 第一次拉项目：`npm install`
2. 配置数据库连接：复制 `.env.example` 为 `.env`
3. 初始化数据库：`npm run db:init`
4. 启动服务：`npm run dev`
5. 只有在你明确要清空全部数据时，才运行 `npm run db:reset`

启动后访问：

- `GET  /api/health` 健康检查
- `POST /api/auth/register` 用户注册
- `POST /api/auth/login` 用户登录
- `GET  /api/auth/me` 获取当前用户（需 `Authorization: Bearer <token>`）

**学习会话**（均需认证）：

- `POST   /api/sessions` 创建会话（AI 自动生成个性化蓝图）
- `GET    /api/sessions` 获取当前用户的会话列表
- `GET    /api/sessions/:id` 获取单个会话
- `PATCH  /api/sessions/:id` 更新会话（标题/状态/进度）
- `DELETE /api/sessions/:id` 删除会话

**知识蓝图**（均需认证）：

- `GET    /api/sessions/:sessionId/blueprint` 获取蓝图
- `PATCH  /api/sessions/:sessionId/blueprint/nodes` 更新节点状态

**AI 教学**（均需认证）：

- `POST   /api/sessions/:sessionId/nodes/:nodeId/content` AI 生成节点学习内容
- `POST   /api/sessions/:sessionId/chat` AI 助教对话（苏格拉底式追问）
- `POST   /api/sessions/:sessionId/chat/stream` AI 对话（SSE 流式）
- `POST   /api/sessions/:sessionId/review` AI 代码评价（4D 评分）

## 响应格式

遵循 SRS §7.1，所有接口返回：

```json
{
  "code": 0,
  "message": "OK",
  "data": {},
  "timestamp": 1730620000000
}
```

`code === 0` 表示成功；其他错误码见 `src/constants/errorCodes.js`。
