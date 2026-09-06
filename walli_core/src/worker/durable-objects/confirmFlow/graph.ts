import {
  Command,
  END,
  START,
  StateGraph,
  StateSchema,
  interrupt,
  type BaseCheckpointSaver,
} from "@langchain/langgraph";
import * as z from "zod";
import { nodeRetryPolicy } from "../../lib/langgraph/retry-policy";
import type { ConfirmFlowEvent, OwnerDecision, UserDecision } from "./types";

const eventSchema = z.object({
  id: z.string(),
  type: z.enum([
    "owner_confirmation_requested",
    "owner_approved",
    "owner_canceled",
    "owner_decision_expired",
    "user_canceled",
  ]),
  audience: z.enum(["owner", "user"]),
  payload: z.unknown(),
  createdAt: z.number(),
});

export const ConfirmFlowState = new StateSchema({
  request: z.unknown(),
  userPrompt: z.string(),
  ownerPrompt: z.string(),
  ownerApprovedMessage: z.string(),
  ownerCanceledMessage: z.string(),
  ownerTimeoutMessage: z.string(),
  ownerTimeoutAt: z.number().nullable(),
  status: z.enum(["waiting_user_confirmation", "waiting_owner_decision", "approved", "canceled", "expired"]),
  userDecision: z.enum(["confirm", "cancel"]).nullable(),
  ownerDecision: z.enum(["approve", "cancel", "timeout"]).nullable(),
  events: z.array(eventSchema),
});

type State = typeof ConfirmFlowState.State;

const appendEvent = (state: State, event: Omit<ConfirmFlowEvent, "id" | "createdAt">) => ({
  events: [...state.events, { ...event, id: crypto.randomUUID(), createdAt: Date.now() }],
});

export const createConfirmGraph = (checkpointer: BaseCheckpointSaver) =>
  new StateGraph(ConfirmFlowState)
    .addNode("prepare", () => ({}))
    .addNode("waitUserConfirm", (state) => {
      const decision = interrupt<{
        type: "user_confirmation";
        prompt: string;
        request: unknown;
      }, UserDecision>({
        type: "user_confirmation",
        prompt: state.userPrompt,
        request: state.request,
      });
      return new Command({ goto: decision === "confirm" ? "notifyOwner" : "cancelFlow", update: {
        userDecision: decision,
      } });
    }, { ends: ["notifyOwner", "cancelFlow"] })
    .addNode("cancelFlow", (state) => ({
      status: "canceled" as const,
      ...appendEvent(state, {
        type: "user_canceled",
        audience: "user",
        payload: { result: "canceled_by_user", request: state.request },
      }),
    }))
    .addNode("notifyOwner", (state) => ({
      status: "waiting_owner_decision" as const,
      ...appendEvent(state, {
        type: "owner_confirmation_requested",
        audience: "owner",
        payload: { prompt: state.ownerPrompt, request: state.request, timeoutAt: state.ownerTimeoutAt },
      }),
    }))
    .addNode("waitOwnerDecision", (state) => {
      const decision = interrupt<{
        type: "owner_decision";
        prompt: string;
        request: unknown;
        timeoutAt: number | null;
      }, OwnerDecision>({
        type: "owner_decision",
        prompt: state.ownerPrompt,
        request: state.request,
        timeoutAt: state.ownerTimeoutAt,
      });
      return new Command({ goto: decision === "approve" ? "approve" : decision === "cancel" ? "cancel" : "expire", update: {
        ownerDecision: decision,
      } });
    }, { ends: ["approve", "cancel", "expire"] })
    .addNode("approve", () => ({ status: "approved" as const }))
    .addNode("cancel", () => ({ status: "canceled" as const }))
    .addNode("expire", () => ({ status: "expired" as const }))
    .addNode("notifyUserApproved", (state) => appendEvent(state, {
      type: "owner_approved",
      audience: "user",
      payload: { message: state.ownerApprovedMessage, result: "approved", request: state.request },
    }))
    .addNode("notifyUserCanceled", (state) => appendEvent(state, {
      type: "owner_canceled",
      audience: "user",
      payload: { message: state.ownerCanceledMessage, result: "canceled", request: state.request },
    }))
    .addNode("notifyUserExpired", (state) => appendEvent(state, {
      type: "owner_decision_expired",
      audience: "user",
      payload: { message: state.ownerTimeoutMessage, result: "expired", request: state.request },
    }))
    .addEdge(START, "prepare")
    .addEdge("prepare", "waitUserConfirm")
    .addEdge("cancelFlow", END)
    .addEdge("notifyOwner", "waitOwnerDecision")
    .addEdge("approve", "notifyUserApproved")
    .addEdge("cancel", "notifyUserCanceled")
    .addEdge("expire", "notifyUserExpired")
    .addEdge("notifyUserApproved", END)
    .addEdge("notifyUserCanceled", END)
    .addEdge("notifyUserExpired", END)
    .setNodeDefaults({ retryPolicy: nodeRetryPolicy })
    .compile({ checkpointer });
