# walli

<p align="center">
  <img src="./docs/assets/walli-core-robot.png" alt="walli 原创机器人吉祥物" width="680" />
</p>

<p align="center">
  <strong>面向机器人、应用与主动智能体的多模态 AI 助手平台。</strong>
</p>

<p align="center">
  <a href="./README.md">English</a> · <a href="./README.zh-CN.md">简体中文</a>
</p>

## walli 是什么？

`walli` 是一个多平台 AI 助手项目，用于构建低成本、可长期在线运行的对话智能体。它从 Telegram 等机器人平台开始，逐步扩展为完整的助手生态：多模态交互、可配置提示语、动态工具、资料库检索、持久记忆、主动触发器，以及面向不同客户端的前端 SDK。

`walli_core` 是 walli 项目的第一个核心包，提供后端基础能力，包括认证、API 路由、存储，以及未来 agent runtime 所需的核心能力。它不是传统的“一问一答”示例项目，而是面向可以记忆、检索、规划、调用工具，并跨平台持续进行多轮对话的长期运行助手。

## 功能规划

- [ ] 快速部署到 Cloudflare，降低运行成本
- [ ] 多模态输入与输出
- [ ] 多平台适配
- [ ] Telegram 集成
- [ ] Web 前端 SDK
- [ ] Flutter 前端 SDK
- [ ] React Native 前端 SDK
- [ ] 系统提示语配置
- [ ] 动态 tools 配置
- [ ] 基础问答资料库，基于向量数据库
- [ ] 存储记忆体
- [ ] 多轮回复，不局限于传统一问一答
- [ ] 主动对话，支持触发器配置

## 当前技术栈

- Cloudflare Workers：边缘运行时
- Hono：后端路由
- React + Vite：管理控制台
- Better Auth：Google 登录与管理员鉴权
- D1：认证与业务关系型存储
- Zod：API 请求与响应类型校验

## 本地启动

```bash
pnpm install
pnpm --filter walli_core dev
```

打开 Vite 输出的本地访问地址。

## 登录配置

创建本地环境变量：

```bash
cd walli_core
cp .dev.vars.example .dev.vars
```

需要填写：

- `BETTER_AUTH_SECRET`：使用 `openssl rand -base64 32` 生成
- `BETTER_AUTH_URL`：Better Auth 对外基础地址，本地开发可用 `http://localhost:5173`
- `BETTER_AUTH_TRUSTED_ORIGINS`：允许访问认证接口的来源，多个值用逗号分隔
- `GOOGLE_CLIENT_ID`：Google OAuth Web Client ID
- `GOOGLE_CLIENT_SECRET`：Google OAuth Web Client Secret
- `ADMIN_EMAILS`：初始化管理员邮箱，多个值用逗号分隔

Google OAuth 回调地址：

```text
http://localhost:5173/api/auth/callback/google
```

远程开发或生产环境中，`BETTER_AUTH_URL` 必须是浏览器可访问的公网地址，不能是只在服务内部有效的 `localhost`。同时需要在 Google Cloud Console 添加对应回调地址：

```text
https://your-domain.com/api/auth/callback/google
```

## D1 初始化

创建数据库：

```bash
pnpm --filter walli_core exec wrangler d1 create walli_core
```

将返回的 `database_id` 写入 `walli_core/wrangler.toml`。Drizzle schema 位于 `walli_core/src/worker/db/schema.ts`，SQL migration 会生成到 `walli_core/migrations`。

修改 Drizzle schema 后生成 migration：

```bash
pnpm run db:generate:walli_core
```

应用本地或远程 migration：

```bash
pnpm run db:migrate:walli_core:local
pnpm run db:migrate:walli_core:remote
```

## 构建与部署

创建一个不会提交到 git 的生产环境变量文件：

```bash
cp walli_core/.dev.vars.example walli_core/.env
```

在 `walli_core/.env` 里填写生产值：

```text
BETTER_AUTH_SECRET="generated-secret"
BETTER_AUTH_URL="https://your-domain.com"
BETTER_AUTH_TRUSTED_ORIGINS="https://your-domain.com"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
ADMIN_EMAILS="admin@example.com"
```

上传到 Cloudflare Workers Secrets：

```bash
pnpm run secrets
```

然后构建并部署：

```bash
pnpm run build:walli_core
pnpm run deploy:walli_core
```

Google OAuth 需要添加生产回调地址：

```text
https://your-domain.com/api/auth/callback/google
```

本项目优先选择 Cloudflare 作为部署目标，因为 Workers、D1 和相关存储产品适合以较低成本支撑中小规模聊天机器人负载。

## 媒体工具性能说明

语音转文字、图片描述、文字转语音等内置媒体 helper 会优先判断入参是否已经匹配目标工具的 schema。如果已经匹配，就直接执行对应工具，避免额外调用调度模型，从而提升 Telegram 等媒体消息处理速度。

如果入参是模糊任务上下文，而不是精确的工具入参，helper 会回退到工具调度模型。在这个 fallback 路径中，一次媒体请求可能包含多次 LLM 调用：先由调度模型把上下文转换为一次工具调用，再执行真正的媒体模型调用，例如 speech-to-text、image-to-text 或 text-to-speech。

## API 接口

- `GET /api/`：服务元信息
- `GET /api/me`：当前登录用户与 session
- `GET /api/admin/status`：管理员状态检查接口
- `/api/auth/*`：Better Auth 认证接口

## 常见标签

`cloudflare-workers`, `hono`, `react`, `vite`, `better-auth`, `d1`, `vector-database`, `rag`, `telegram-bot`, `chatbot`, `ai-agent`, `multimodal`, `tool-calling`, `memory`, `proactive-ai`, `frontend-sdk`, `flutter`, `react-native`, `typescript`, `zod`
