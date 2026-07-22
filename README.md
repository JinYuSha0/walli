# walli

<p align="center">
  <img src="./docs/assets/walli-core-robot.png" alt="walli original robot mascot" width="680" />
</p>

<p align="center">
  <strong>Multimodal AI assistant platform for bots, apps, and proactive agents.</strong>
</p>

<p align="center">
  <a href="./README.md">English</a> · <a href="./README.zh-CN.md">简体中文</a>
</p>

## What is walli?

`walli` is a multi-platform AI assistant project for building affordable, always-on conversational agents. It starts with bot platforms such as Telegram and grows toward a full assistant ecosystem: multimodal interaction, configurable prompts, dynamic tools, retrieval-augmented knowledge, persistent memory, proactive triggers, and frontend SDKs.

`walli_core` is the first core package in the walli project. It provides the backend foundation for authentication, API routing, storage, and future agent runtime capabilities. The goal is not a simple one-question-one-answer demo; walli is intended to support long-running assistants that can remember, retrieve, plan, call tools, and continue multi-turn conversations across platforms.

## Feature Roadmap

- [ ] Fast Cloudflare deployment with low operating cost
- [ ] Multimodal input and output
- [ ] Multi-platform adapters
- [ ] Telegram integration
- [ ] Web frontend SDK
- [ ] Flutter frontend SDK
- [ ] React Native frontend SDK
- [ ] System prompt configuration
- [ ] Dynamic tools configuration
- [ ] Basic Q&A knowledge base backed by a vector database
- [ ] Persistent memory storage
- [ ] Multi-turn replies beyond traditional single-turn Q&A
- [ ] Proactive conversations with trigger configuration

## Current Stack

- Cloudflare Workers for edge runtime
- Hono for backend routing
- React + Vite for the admin console
- Better Auth for Google login and admin access
- D1 for relational auth/application storage
- Zod for API request/response validation

## Quick Start

```bash
pnpm install
pnpm --filter walli_core dev
```

Open the local URL printed by Vite.

## Authentication Setup

Create local environment variables:

```bash
cd walli_core
cp .dev.vars.example .dev.vars
```

Required values:

- `BETTER_AUTH_SECRET`: generate with `openssl rand -base64 32`
- `BETTER_AUTH_URL`: public base URL for Better Auth, for example `http://localhost:5173` in local development
- `BETTER_AUTH_TRUSTED_ORIGINS`: comma-separated allowed origins
- `GOOGLE_CLIENT_ID`: Google OAuth web client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth web client secret
- `ADMIN_EMAILS`: comma-separated bootstrap admin emails

Google OAuth redirect URI:

```text
http://localhost:5173/api/auth/callback/google
```

For remote development or production, `BETTER_AUTH_URL` must be a browser-reachable public URL, not an internal-only `localhost`. Add the matching callback URL in Google Cloud Console:

```text
https://your-domain.com/api/auth/callback/google
```

## D1 Setup

Create the database:

```bash
pnpm --filter walli_core exec wrangler d1 create walli_core
```

Copy the returned `database_id` into `walli_core/wrangler.toml`. Drizzle schema lives in `walli_core/src/worker/db/schema.ts`, and SQL migrations are generated into `walli_core/migrations`.

Generate migrations after changing the Drizzle schema:

```bash
pnpm run db:generate:walli_core
```

Apply migrations locally or remotely:

```bash
pnpm run db:migrate:walli_core:local
pnpm run db:migrate:walli_core:remote
```

## Build and Deploy

Create a production env file that is not committed to git:

```bash
cp walli_core/.dev.vars.example walli_core/.env
```

Use production values in `walli_core/.env`:

```text
BETTER_AUTH_SECRET="generated-secret"
BETTER_AUTH_URL="https://your-domain.com"
BETTER_AUTH_TRUSTED_ORIGINS="https://your-domain.com"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
ADMIN_EMAILS="admin@example.com"
```

Upload the values to Cloudflare Workers secrets:

```bash
pnpm run secrets
```

Then build and deploy:

```bash
pnpm run build:walli_core
pnpm run deploy:walli_core
```

Google OAuth must include this production callback URL:

```text
https://your-domain.com/api/auth/callback/google
```

Cloudflare is the intended deployment target because Workers, D1, and related storage products keep the runtime lightweight and inexpensive for small-to-medium chatbot workloads.

## Media Tool Performance

Built-in media helpers such as voice transcription, image description, and voice synthesis first try to execute the target tool directly when the input already matches that tool's schema. This avoids an extra planner-model request and keeps Telegram media handling faster.

If the input is fuzzy task context instead of exact tool input, the helper falls back to the tool planner model. In that fallback path, a single media request can involve multiple LLM calls: one planner call to translate the context into a tool invocation, plus the actual media model call such as speech-to-text, image-to-text, or text-to-speech.

## API Surface

- `GET /api/`: service metadata
- `GET /api/me`: current authenticated user/session
- `GET /api/admin/status`: admin-only health/status endpoint
- `/api/auth/*`: Better Auth endpoints

## Common Tags

`cloudflare-workers`, `hono`, `react`, `vite`, `better-auth`, `d1`, `vector-database`, `rag`, `telegram-bot`, `chatbot`, `ai-agent`, `multimodal`, `tool-calling`, `memory`, `proactive-ai`, `frontend-sdk`, `flutter`, `react-native`, `typescript`, `zod`
