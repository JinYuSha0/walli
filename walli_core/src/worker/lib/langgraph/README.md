# Durable LangGraph

Shared infrastructure for LangGraph flows hosted by Durable Objects.

```text
langgraph/
├── durable-graph-object.ts  # graph execution, persistent retry and Alarm
├── retry-policy.ts         # retry options, backoff and error classification
├── sqlite.ts               # Drizzle tables, checkpointer, retry repository, migrations
└── index.ts                # public API
```

Durable Object implementations import the base from the public entrypoint.
Pure graph modules may import `retry-policy.ts` directly so Node-based tests do
not load the Cloudflare runtime:

```ts
// Durable Object module
import { DurableLangGraphObject } from "../../lib/langgraph";

// Pure graph module
import { nodeRetryPolicy } from "../../lib/langgraph/retry-policy";
```

Each Durable Object has an isolated SQLite database, so different DO instances
can safely use the same generic table names. A graph invocation must still use
a stable `thread_id` to identify its execution history.

`retry-policy.ts` contains only retry decisions and delay calculation; it has no
database or Cloudflare dependency. `nodeRetryPolicy` provides generic retries inside one graph invocation. Every
ordinary thrown value is retried by default. Throw `NonRetryableError` for a
business failure that must stop immediately; abort errors are also excluded.
LangGraph interrupts remain normal control flow and are not retried. This policy
does not replace a Durable Object Alarm or Queue for delayed retries across
invocations.

`DurableLangGraphObject` is the reusable DO base class. It directly owns the
persistent retry store and Cloudflare `alarm()` entrypoint.
Business DOs register their graph, call `invokeLangGraph()`, and do not implement
retry catches or alarm dispatch. After the node's built-in retry policy is
exhausted, the base class persists the attempt, schedules an alarm, resumes from
the checkpoint, and eventually marks the retry exhausted. Domain timers may use
the optional external-deadline hooks without participating in retry logic.
