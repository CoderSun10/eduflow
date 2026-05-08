# EduFlow 前端

EduFlow AI v1.0 的 Web 前端（React + Vite，纯 JavaScript）。

## 启动

```bash
cp .env.example .env       # 如需自定义后端地址
npm install
npm run dev                # 默认在 http://localhost:5173
```

开发模式下，Vite 会把 `/api` 自动代理到 `http://localhost:4000`，
所以同时启动 `backend/` 即可端到端联调。

## 目录结构

```
src/
├── api/              # axios 客户端 + 各业务接口（authApi、blueprintApi …）
├── components/
│   ├── common/       # Logo / Button / TextField 等无业务的纯 UI
│   └── layout/       # Sidebar / AppShell 等结构性组件
├── pages/            # 路由级页面，按特性目录划分
│   ├── Login/
│   ├── Home/
│   └── Workbench/
├── hooks/            # 自定义 Hook（业务化封装 store + api）
├── store/            # Zustand 全局状态
├── utils/            # 纯函数工具：storage / format …
├── constants/        # 路由路径、storage key 等常量
├── styles/           # tokens.css / global.css，唯一的全局样式入口
├── router/           # 路由声明 + ProtectedRoute
├── App.jsx           # 全局 Provider 组装
└── main.jsx          # 渲染入口
```

## 设计令牌

所有颜色、字体、圆角等设计变量集中在 `src/styles/tokens.css`。
要换主题（深色版）只需新增一个 token 文件并切换根类即可，
业务组件不直接写颜色字面量。

数值来自 `description/page*_light.html` 三个设计稿，主色 `#1a56db`，
中文 / 英文混排时使用 `DM Sans + JetBrains Mono` 双字体。

## 分层与命名约定

| 层级           | 职责                                         | 示例                              |
| -------------- | -------------------------------------------- | --------------------------------- |
| `api/`         | 与后端通信的薄封装；不触碰 React             | `authApi.login(payload)`          |
| `store/`       | 全局共享状态（Zustand）                      | `useAuthStore`                    |
| `hooks/`       | 把 store + api + 业务规则打包成 Hook         | `useAuth().login(...)`            |
| `components/`  | 不依赖路由 / 业务的纯 UI                     | `<Button />`、`<TextField />`     |
| `pages/`       | 路由级页面，可有页面内 sub-components 子目录 | `pages/Workbench/`                |
| `utils/`       | 纯函数，可在任意层使用                       | `formatDuration(90)`              |
| `constants/`   | 路径 / 枚举字符串，避免散落硬编码            | `RoutePaths.HOME`                 |

## 当前可用页面

| 路径                       | 功能                                       | 数据状态          |
| -------------------------- | ------------------------------------------ | ----------------- |
| `/login`                   | 邮箱密码登录（联通后端 `/api/auth/login`） | 已联调            |
| `/home`                    | 主页：意图输入 / 进行中会话 / 数据卡       | 静态 mock，待接入 |
| `/workbench/:sessionId`    | 三栏工作台：知识树 / 内容 / AI 助手        | 静态 mock，待接入 |

后续要做的事见 `description/EduFlow_AI_SRS_v1.0.docx` §9.2 Phase 1 任务清单。
