import type { PersistentRetryOptions } from "../../lib/langgraph";

export type UserDecision = "confirm" | "cancel";
export type OwnerDecision = "approve" | "cancel" | "timeout";

export type ConfirmFlowStatus =
  | "waiting_user_confirmation"
  | "waiting_owner_decision"
  | "approved"
  | "canceled"
  | "expired";

export type ConfirmFlowInput = {
  request: unknown;
  userPrompt?: string;
  ownerPrompt?: string;
  ownerApprovedMessage?: string;
  ownerCanceledMessage?: string;
  ownerTimeoutMessage?: string;
  ownerTimeoutAt?: number;
  retry?: PersistentRetryOptions;
};

export type ConfirmFlowEventType =
  | "owner_confirmation_requested"
  | "owner_approved"
  | "owner_canceled"
  | "owner_decision_expired"
  | "user_canceled";

export type ConfirmFlowEvent = {
  id: string;
  type: ConfirmFlowEventType;
  audience: "owner" | "user";
  payload: unknown;
  createdAt: number;
};

export type ConfirmFlowSnapshot = {
  id: string;
  status: ConfirmFlowStatus;
  request: unknown;
  userDecision: UserDecision | null;
  ownerDecision: OwnerDecision | null;
  ownerTimeoutAt: number | null;
  interrupt: unknown | null;
  events: ConfirmFlowEvent[];
  retry: {
    status: "pending" | "exhausted";
    attemptCount: number;
    maxAttempts: number;
    nextAttemptAt: number | null;
    lastError: string;
  } | null;
};
