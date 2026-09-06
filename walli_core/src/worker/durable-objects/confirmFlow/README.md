# confirmFlow

Each confirmation uses one named Durable Object. The object name is the stable
LangGraph `thread_id`, so the same ID must be used for every action.

```ts
const flow = env.CONFIRM_FLOW_DO.getByName(confirmId);

await flow.start({
  request: { operation: "publish", documentId },
  ownerApprovedMessage: "Your request was approved.",
  ownerCanceledMessage: "Your request was canceled by the owner.",
  ownerTimeoutMessage: "The owner did not respond in time.",
  ownerTimeoutAt: Date.now() + 30 * 60_000,
  retry: {
    maxAttempts: 8,
    initialInterval: 1_000,
    backoffFactor: 2,
    maxInterval: 60 * 60_000,
    jitter: true,
  },
});

await flow.userAction("confirm"); // or "cancel"
await flow.ownerAction("approve"); // or "cancel"
const snapshot = await flow.getStatus();
```

The graph uses the shared Durable Object checkpointer in `worker/lib/langgraph`.
`start()` and action methods return the current snapshot. While paused,
`snapshot.interrupt` contains the JSON payload emitted by LangGraph. Notification
nodes append durable outbox-style records to `snapshot.events`; the application
can deliver those records using its existing notification channel.

The notification actions are:

- user confirms: `owner_confirmation_requested` is addressed to the owner;
- owner approves: `owner_approved` is addressed to the user;
- owner cancels: `owner_canceled` is addressed to the user;
- owner times out: `owner_decision_expired` is addressed to the user.

If `ownerTimeoutAt` is set, `userAction("confirm")` schedules a Durable Object
alarm. The alarm resumes the owner interrupt with `timeout`, leading to the
`expired` state. LangGraph checkpoints and pending writes are stored in the
object’s SQLite database, not in memory.

When an invocation still fails after LangGraph's short retries, the DO persists
the retry record and schedules its single alarm at `nextAttemptAt`. Alarm retries
continue from the latest checkpoint. The delay is exponential and capped by
`maxInterval`; `jitter` spreads retries from different DO instances. A retry is
marked `exhausted` when `maxAttempts` is reached. The same alarm also handles the
owner decision timeout by always scheduling the earliest due timestamp.
