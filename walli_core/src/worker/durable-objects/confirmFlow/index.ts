import { Command } from "@langchain/langgraph";
import { DurableLangGraphObject } from "../../lib/langgraph";
import { createConfirmGraph } from "./graph";
import type {
  ConfirmFlowInput,
  ConfirmFlowSnapshot,
  ConfirmFlowStatus,
  OwnerDecision,
  UserDecision,
} from "./types";

export type * from "./types";

export class ConfirmFlowDO extends DurableLangGraphObject<Env> {
  private readonly graph: ReturnType<typeof createConfirmGraph>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.graph = createConfirmGraph(this.langGraphCheckpointer);
    this.registerLangGraph(this.graph);
  }

  async start(input: ConfirmFlowInput): Promise<ConfirmFlowSnapshot> {
    const current = await this.getStatus();
    if (current) throw new Error("Confirm flow has already started");

    if (input.ownerTimeoutAt !== undefined && !Number.isFinite(input.ownerTimeoutAt)) {
      throw new Error("ownerTimeoutAt must be a finite Unix timestamp in milliseconds");
    }
    this.configureLangGraphRetry(input.retry);

    await this.invokeLangGraph(
      {
        request: input.request,
        userPrompt: input.userPrompt ?? "Please confirm this action.",
        ownerPrompt: input.ownerPrompt ?? "Please approve or cancel this action.",
        ownerApprovedMessage: input.ownerApprovedMessage ?? "The owner approved your request.",
        ownerCanceledMessage: input.ownerCanceledMessage ?? "The owner canceled your request.",
        ownerTimeoutMessage: input.ownerTimeoutMessage ?? "The owner did not respond in time.",
        ownerTimeoutAt: input.ownerTimeoutAt ?? null,
        status: "waiting_user_confirmation",
        userDecision: null,
        ownerDecision: null,
        events: [],
      },
      this.langGraphConfig(),
    );
    return this.requireStatus();
  }

  async userAction(decision: UserDecision): Promise<ConfirmFlowSnapshot> {
    if (decision !== "confirm" && decision !== "cancel") {
      throw new Error("User decision must be confirm or cancel");
    }
    const current = await this.requireStatus();
    if (current.status !== "waiting_user_confirmation") {
      throw new Error("Confirm flow is not waiting for a user decision");
    }

    await this.invokeLangGraph(new Command({ resume: decision }), this.langGraphConfig());
    const next = await this.requireStatus();
    if (next.status === "waiting_owner_decision" && next.ownerTimeoutAt !== null) {
      if (next.ownerTimeoutAt <= Date.now()) await this.expire();
      else await this.refreshLangGraphAlarm();
    }
    return this.requireStatus();
  }

  async ownerAction(decision: Exclude<OwnerDecision, "timeout">): Promise<ConfirmFlowSnapshot> {
    if (decision !== "approve" && decision !== "cancel") {
      throw new Error("Owner decision must be approve or cancel");
    }
    const current = await this.requireStatus();
    if (current.status !== "waiting_owner_decision") {
      throw new Error("Confirm flow is not waiting for an owner decision");
    }
    await this.invokeLangGraph(new Command({ resume: decision }), this.langGraphConfig());
    await this.refreshLangGraphAlarm();
    return this.requireStatus();
  }

  protected async getLangGraphExternalDeadline(): Promise<number | null> {
    const current = await this.getStatus();
    return current?.status === "waiting_owner_decision"
      ? current.ownerTimeoutAt
      : null;
  }

  protected async onLangGraphExternalDeadline(): Promise<null> {
    await this.expire();
    return null;
  }

  async getStatus(): Promise<ConfirmFlowSnapshot | null> {
    const snapshot = await this.graph.getState(this.langGraphConfig());
    if (!snapshot.config?.configurable?.checkpoint_id) return null;
    const values = snapshot.values as Record<string, unknown>;
    const interrupt = snapshot.tasks.flatMap((task) => task.interrupts ?? [])[0]?.value ?? null;
    return {
      id: this.langGraphThreadId,
      status: values.status as ConfirmFlowStatus,
      request: values.request,
      userDecision: (values.userDecision ?? null) as UserDecision | null,
      ownerDecision: (values.ownerDecision ?? null) as OwnerDecision | null,
      ownerTimeoutAt: (values.ownerTimeoutAt ?? null) as number | null,
      interrupt,
      events: (values.events ?? []) as ConfirmFlowSnapshot["events"],
      retry: (() => {
        const retry = this.getLangGraphRetry();
        return retry
          ? {
              status: retry.status,
              attemptCount: retry.attemptCount,
              maxAttempts: retry.maxAttempts,
              nextAttemptAt: retry.nextAttemptAt,
              lastError: retry.lastError,
            }
          : null;
      })(),
    };
  }

  private async expire(): Promise<void> {
    const current = await this.getStatus();
    if (current?.status !== "waiting_owner_decision") return;
    await this.invokeLangGraph(
      new Command({ resume: "timeout" satisfies OwnerDecision }),
      this.langGraphConfig(),
    );
  }

  private async requireStatus(): Promise<ConfirmFlowSnapshot> {
    const status = await this.getStatus();
    if (!status) throw new Error("Confirm flow has not started");
    return status;
  }
}
