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
