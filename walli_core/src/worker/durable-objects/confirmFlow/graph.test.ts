import { Command, MemorySaver } from "@langchain/langgraph";
import { describe, expect, it } from "vitest";
import { createConfirmGraph } from "./graph";

const initialState = (ownerTimeoutAt: number | null = null) => ({
  request: { operation: "publish" },
  userPrompt: "Confirm publish?",
  ownerPrompt: "Approve publish?",
  ownerApprovedMessage: "Approved.",
  ownerCanceledMessage: "Canceled.",
  ownerTimeoutMessage: "Expired.",
  ownerTimeoutAt,
  status: "waiting_user_confirmation" as const,
  userDecision: null,
  ownerDecision: null,
  events: [],
});

describe("confirmFlow", () => {
  it("ends immediately when the user cancels", async () => {
    const graph = createConfirmGraph(new MemorySaver());
    const config = { configurable: { thread_id: "user-cancel" } };

    const waiting = await graph.invoke(initialState(), config);
    expect(waiting.__interrupt__[0].value).toMatchObject({ type: "user_confirmation" });

    const result = await graph.invoke(new Command({ resume: "cancel" }), config);
    expect(result.status).toBe("canceled");
    expect(result.userDecision).toBe("cancel");
    expect(result.events).toMatchObject([{ type: "user_canceled", audience: "user" }]);
  });

  it.each([
    ["approve", "approved"],
    ["cancel", "canceled"],
    ["timeout", "expired"],
  ] as const)("routes owner %s to %s", async (decision, status) => {
    const graph = createConfirmGraph(new MemorySaver());
    const config = { configurable: { thread_id: `owner-${decision}` } };

    await graph.invoke(initialState(Date.now() + 60_000), config);
    const waitingOwner = await graph.invoke(new Command({ resume: "confirm" }), config);
    expect(waitingOwner.status).toBe("waiting_owner_decision");
    expect(waitingOwner.__interrupt__[0].value).toMatchObject({ type: "owner_decision" });

    const result = await graph.invoke(new Command({ resume: decision }), config);
    expect(result.status).toBe(status);
    expect(result.ownerDecision).toBe(decision);
    expect(result.events.map((event) => event.type)).toEqual([
      "owner_confirmation_requested",
      decision === "approve"
        ? "owner_approved"
        : decision === "cancel"
          ? "owner_canceled"
          : "owner_decision_expired",
    ]);
    expect(result.events[1].audience).toBe("user");
  });
});
