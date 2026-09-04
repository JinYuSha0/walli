import { DurableObject } from "cloudflare:workers";
import { WithAsyncContext } from "../../src/worker/lib/durable-object-context";
import { getAsyncContext, extendChatAsyncContext } from "../../src/worker/lib/async-context";
export { UserDO } from "../../src/worker/durable-objects/user";

const initialize = Symbol("initialize");

export class ContextProbe extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this[initialize]();
  }

  private [initialize]() {
    void this.ctx.blockConcurrencyWhile(async () => {
      await Promise.resolve();
      await this.ctx.storage.put("initialized", getAsyncContext().env.API_TOKEN);
    });
  }

  read() {
    const context = getAsyncContext();
    return { token: context.env.API_TOKEN, sessionId: context.sessionId ?? null, name: this.ctx.id.name };
  }

  async nested(sessionId: string) {
    return extendChatAsyncContext({ sessionId }, async () => {
      await Promise.resolve();
      return this.read();
    });
  }

  async arm() { await this.ctx.storage.setAlarm(Date.now() + 20); }

  async alarm() {
    await Promise.resolve();
    await this.ctx.storage.put("alarm", this.read());
  }

  async status() {
    return {
      initialized: await this.ctx.storage.get("initialized"),
      alarm: await this.ctx.storage.get("alarm"),
      current: this.read(),
    };
  }

  async fetch() { return Response.json(this.read()); }
}

WithAsyncContext(ContextProbe);

export default {
  async fetch(request: Request, env: Env & { PROBE: DurableObjectNamespace<ContextProbe> }) {
    const url = new URL(request.url);
    const probe = env.PROBE.getByName(url.searchParams.get("name") ?? "first");
    if (url.pathname === "/arm") { await probe.arm(); return new Response("ok"); }
    if (url.pathname === "/nested") return Response.json(await probe.nested("task"));
    if (url.pathname === "/fetch") return probe.fetch(request);
    if (url.pathname === "/user") {
      const user = env.USER_DO.getByName("client-1:web:user-1");
      const session = await user.createSession({ clientId: "client-1" });
      const usage = await user.getTodayTokenUsage();
      return Response.json({ session, usage });
    }
    return Response.json(await probe.status());
  },
};
