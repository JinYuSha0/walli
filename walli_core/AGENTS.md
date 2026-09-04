# Cloudflare Workers

STOP. Your knowledge of Cloudflare Workers APIs and limits may be outdated. Always retrieve current documentation before any Workers, KV, R2, D1, Durable Objects, Queues, Vectorize, AI, or Agents SDK task.

## Docs

- https://developers.cloudflare.com/workers/
- MCP: `https://docs.mcp.cloudflare.com/mcp`

For all limits and quotas, retrieve from the product's `/platform/limits/` page. eg. `/workers/platform/limits`

## Commands

| Command                | Purpose                   |
| ---------------------- | ------------------------- |
| `pnpm wrangler dev`    | Local development         |
| `pnpm wrangler deploy` | Deploy to Cloudflare      |
| `pnpm wrangler types`  | Generate TypeScript types |

Run `wrangler types` after changing bindings in wrangler.toml.

## Frontend Loading

Every page-level initial data load must render a skeleton screen. Do not show the final form/page with disabled controls or a button spinner while initial page data is still loading.

## Verification

Do not run a full build after every small change. Prefer lint or a targeted lightweight check for minor UI, copy, or styling edits. Run the full build when changing build configuration, routing/code-splitting, Worker/API contracts, dependencies, or when explicitly requested.

## API Responses

API response `message` fields must be written in English, including error and guidance messages. Keep localized copy in frontend locale files, not Worker API responses.

## Node.js Compatibility

https://developers.cloudflare.com/workers/runtime-apis/nodejs/

## Coding Preferences: Async Context

- Use `AsyncLocalStorage` (`node:async_hooks`) for request-scoped dependencies. The accessor is `getAsyncContext()`; do not introduce `getWorkerEnv()` or restore `getChatAsyncContext()`.
- Initialize context once at the Worker request boundary using `c.env` and the execution context. Shared services read bindings through `getAsyncContext().env`; do not pass `env`, `APP_KV`, or other context-available dependencies down the call chain. Prefer `getSettings()` over `getSettings(getAsyncContext().env.APP_KV)`.
- Durable Object internals use `this.env` and `this.ctx` directly. Apply `WithAsyncContext(UserDO)` once at class level so shared services called from DO methods have context; do not reintroduce repeated `runWithChatAsyncContext` or `withSharedContext` wrappers at individual call sites.
- Keep wrapped DO entrypoints on the prototype, not as arrow-function fields. Constructor work that requires context must enter through a wrapped initialization method. Preserve context for nested calls on the same instance and isolate different instances and concurrent invocations.
- Extend task-local `userInfo`/`sessionId` with `extendChatAsyncContext`; do not store request/task context on an instance or in mutable global state. Bind deferred callbacks when they may execute outside their creation context.
- Generic tool executors must not identify tools by name to inject runtime context. Tools that need context read it in their own handlers. Preserve explicitly supported direct-API input when no chat context exists.
- Keep business arguments distinct from ambient dependencies: `clientId` must not fall back to a platform string. Use `clientId` consistently in types and parameters, and `client_id` for its SQL column. `platform` is a separate `streamChat` argument, not a field on `userInfo` or an argument to `createChatUserInfo`.
- Do not silently fabricate context when it is missing; retain the accessor's fail-fast error. After changing context boundaries, verify nested calls, concurrent isolation, initialization, RPC, and alarms. Use `tsc -b` for the referenced TypeScript projects and `pnpm test:do-context` for the actual Workers runtime checks; root `tsc --noEmit` alone is insufficient.

## Errors

- **Error 1102** (CPU/Memory exceeded): Retrieve limits from `/workers/platform/limits/`
- **All errors**: https://developers.cloudflare.com/workers/observability/errors/

## Product Docs

Retrieve API references and limits from:
`/kv/` · `/r2/` · `/d1/` · `/durable-objects/` · `/queues/` · `/vectorize/` · `/workers-ai/` · `/agents/`

## Best Practices (conditional)

If the application uses Durable Objects or Workflows, refer to the relevant best practices:

- Durable Objects: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- Workflows: https://developers.cloudflare.com/workflows/build/rules-of-workflows/
