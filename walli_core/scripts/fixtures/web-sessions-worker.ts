import { UserDO } from "../../src/worker/durable-objects/user";

export class SessionProbe extends UserDO {
  seed() {
    // Equal timestamps exercise the ID tie-breaker at every page boundary.
    for (let index = 0; index < 45; index++) {
      this.ctx.storage.sql.exec(
        "INSERT INTO sessions (id, client_id, summary, created_at) VALUES (?, ?, ?, ?)",
        `session-${String(index).padStart(2, "0")}`,
        "client-1",
        `Conversation ${index}`,
        1000,
      );
    }
  }

  async prepareCleanup() {
    await this.addMessages([
      { id: "old-message", sessionId: "old-session", content: "old", inputToken: 0, outputToken: 0 },
      { id: "new-message", sessionId: "new-session", content: "new", inputToken: 0, outputToken: 0 },
    ]);
    this.ctx.storage.sql.exec("UPDATE messages SET created_at = 1 WHERE id = 'old-message'");
    this.ctx.storage.sql.exec(
      "INSERT INTO sessions (id, client_id, summary, created_at) VALUES ('old-session', 'client-1', 'Old', 1), ('new-session', 'client-1', 'New', 1)",
    );
    const deadline = Date.now() + 3600000;
    this.ctx.storage.sql.exec(
      "UPDATE scheduled_tasks SET scheduled_at = ? WHERE type = 'system:conversation-cleanup' AND status = 'pending'", deadline,
    );
    await this.ctx.storage.setAlarm(deadline);
    return deadline;
  }

  cleanupDeadline() {
    return this.ctx.storage.sql.exec(
      "SELECT scheduled_at FROM scheduled_tasks WHERE type = 'system:conversation-cleanup' AND status = 'pending'",
    ).one().scheduled_at;
  }

  async runCleanup() {
    this.ctx.storage.sql.exec(
      "UPDATE scheduled_tasks SET scheduled_at = 1 WHERE type = 'system:conversation-cleanup' AND status = 'pending'",
    );
    await this.alarm();
    return {
      sessions: await this.listSessions(),
      oldMessages: await this.listMessagesBefore("old-session", undefined, 30),
      newMessages: await this.listMessagesBefore("new-session", undefined, 30),
      nextDeadline: this.cleanupDeadline(),
    };
  }

  inspect(sessionId: string) {
    return this.ctx.storage.sql
      .exec("SELECT deleted_at FROM sessions WHERE id = ?", sessionId)
      .one();
  }
}

export default {
  async fetch(_request: Request, env: { USER_DO: DurableObjectNamespace<SessionProbe> }) {
    const path = new URL(_request.url).pathname;
    if (path.startsWith("/cleanup")) {
      const cleanup = env.USER_DO.getByName("client-1:web:cleanup-test");
      return Response.json(path === "/cleanup/prepare"
        ? await cleanup.prepareCleanup()
        : path === "/cleanup/deadline"
          ? await cleanup.cleanupDeadline()
          : await cleanup.runCleanup());
    }
    const user = env.USER_DO.getByName("client-1:web:pagination-test");
    await user.seed();
    await user.addMessages([
      {
        id: "retained-message",
        sessionId: "session-25",
        inputToken: 10,
        outputToken: 20,
        content: JSON.stringify({ role: "user", content: "Keep this message" }),
      },
    ]);
    const first = await user.listSessionsPage({ limit: 20 });
    // Delete the boundary row: the cursor must still work without that row being visible.
    const deletion = await user.softDeleteSession("session-25");
    const secondDeletion = await user.softDeleteSession("session-25");
    const second = await user.listSessionsPage({
      cursor: JSON.parse(first.nextCursor!),
      limit: 20,
    });
    const third = await user.listSessionsPage({
      cursor: JSON.parse(second.nextCursor!),
      limit: 20,
    });
    let rejectedDeletedSession = false;
    try {
      await user.getOrCreateSession({ id: "session-25" });
    } catch {
      rejectedDeletedSession = true;
    }
    const other = env.USER_DO.getByName("client-1:web:another-visitor");
    return Response.json({
      first,
      second,
      third,
      deletion,
      secondDeletion,
      rejectedDeletedSession,
      deletedSession: (await user.getSession("session-25")) ?? null,
      active: await user.listSessions(),
      record: await user.inspect("session-25"),
      messages: await user.listMessagesBefore("session-25", undefined, 30),
      usage: await user.getTokenUsageSince(0),
      otherVisitor: await other.listSessionsPage(),
    });
  },
};
