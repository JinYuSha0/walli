import { DurableObject } from "cloudflare:workers";
import type { BaseCheckpointSaver, LangGraphRunnableConfig } from "@langchain/langgraph";
import { isRetryableError, type PersistentRetryOptions } from "./retry-policy";
import {
  createDurableLangGraphSqlite,
  type DurableGraphRetryStore,
  type LangGraphRetry,
} from "./sqlite";

type InvokableGraph = {
  invoke(input: unknown, config: LangGraphRunnableConfig): Promise<unknown>;
};

/**
 * Reusable Durable Object base for persistent LangGraph execution.
 * Subclasses register a graph once and never implement retry or alarm plumbing.
 */
export abstract class DurableLangGraphObject<EnvT> extends DurableObject<EnvT> {
  protected readonly langGraphCheckpointer: BaseCheckpointSaver;
  protected readonly langGraphThreadId: string;
  private readonly langGraphRetries: DurableGraphRetryStore;
  private langGraph: InvokableGraph | undefined;

  constructor(ctx: DurableObjectState, env: EnvT) {
    super(ctx, env);
    this.langGraphThreadId = ctx.id.name ?? ctx.id.toString();
    const persistence = createDurableLangGraphSqlite(ctx.storage);
    this.langGraphCheckpointer = persistence.checkpointer;
    this.langGraphRetries = persistence.retries;
    void ctx.blockConcurrencyWhile(persistence.migrate);
  }

  protected registerLangGraph(graph: InvokableGraph): void {
    if (this.langGraph) throw new Error("LangGraph has already been registered");
    this.langGraph = graph;
  }

  protected configureLangGraphRetry(options?: PersistentRetryOptions): void {
    this.langGraphRetries.configure(this.langGraphThreadId, options);
  }

  protected async invokeLangGraph<Result>(
    input: unknown,
    config: LangGraphRunnableConfig,
  ): Promise<Result> {
    try {
      const result = await this.requireGraph().invoke(input, config);
      this.langGraphRetries.clear(this.langGraphThreadId);
      return result as Result;
    } catch (error) {
      if (!isRetryableError(error)) throw error;
      const retry = this.langGraphRetries.recordFailure(this.langGraphThreadId, error);
      await this.scheduleRetryWithoutOverwritingEarlierAlarm(retry.nextAttemptAt);
      throw error;
    }
  }

  protected getLangGraphRetry(): LangGraphRetry | undefined {
    return this.langGraphRetries.get(this.langGraphThreadId);
  }

  protected async refreshLangGraphAlarm(): Promise<void> {
    await this.rescheduleLangGraphAlarm(await this.getLangGraphExternalDeadline());
  }

  /** Optional domain deadline sharing the DO's single alarm with graph retries. */
  protected getLangGraphExternalDeadline(): Promise<number | null> | number | null {
    return null;
  }

  /** Return the next deadline, or null after consuming the current deadline. */
  protected onLangGraphExternalDeadline(): Promise<number | null> {
    return Promise.resolve(null);
  }

  async alarm(): Promise<void> {
    const retry = this.langGraphRetries.getDue(this.langGraphThreadId);
    if (retry) {
      try {
        await this.requireGraph().invoke(null, this.langGraphConfig());
        this.langGraphRetries.clear(this.langGraphThreadId);
      } catch (error) {
        if (isRetryableError(error)) {
          this.langGraphRetries.recordFailure(this.langGraphThreadId, error);
        } else {
          this.langGraphRetries.exhaust(this.langGraphThreadId, error);
        }
      }
    }

    let nextExternalDeadline = await this.getLangGraphExternalDeadline();
    if (nextExternalDeadline !== null && nextExternalDeadline <= Date.now()) {
      nextExternalDeadline = await this.onLangGraphExternalDeadline();
    }

    await this.rescheduleLangGraphAlarm(nextExternalDeadline);
  }

  protected langGraphConfig(): LangGraphRunnableConfig {
    return { configurable: { thread_id: this.langGraphThreadId } };
  }

  private async rescheduleLangGraphAlarm(externalDeadline: number | null): Promise<void> {
    const retryAt = this.langGraphRetries.get(this.langGraphThreadId)?.nextAttemptAt ?? null;
    const dueTimes = [retryAt, externalDeadline]
      .filter((timestamp): timestamp is number => timestamp !== null);

    if (dueTimes.length === 0) {
      await this.ctx.storage.deleteAlarm();
      return;
    }

    await this.ctx.storage.setAlarm(Math.max(Date.now(), Math.min(...dueTimes)));
  }

  private async scheduleRetryWithoutOverwritingEarlierAlarm(
    retryAt: number | null,
  ): Promise<void> {
    if (retryAt === null) return;
    const currentAlarm = await this.ctx.storage.getAlarm();
    if (currentAlarm === null || retryAt < currentAlarm) {
      await this.ctx.storage.setAlarm(retryAt);
    }
  }

  private requireGraph(): InvokableGraph {
    if (!this.langGraph) throw new Error("LangGraph has not been registered");
    return this.langGraph;
  }
}
