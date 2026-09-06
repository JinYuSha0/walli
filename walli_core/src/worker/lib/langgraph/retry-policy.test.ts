import { END, MemorySaver, START, StateGraph, StateSchema } from "@langchain/langgraph";
import { describe, expect, it } from "vitest";
import * as z from "zod";
import {
  NonRetryableError,
  RetryableError,
  calculateRetryDelay,
  isRetryableError,
  nodeRetryPolicy,
  normalizePersistentRetryOptions,
} from "./retry-policy";

describe("LangGraph node retry", () => {
  it("normalizes persistent retry settings and caps exponential backoff", () => {
    const options = normalizePersistentRetryOptions({
      maxAttempts: 5,
      initialInterval: 1_000,
      backoffFactor: 3,
      maxInterval: 5_000,
      jitter: false,
    });

    expect(calculateRetryDelay(1, options)).toBe(1_000);
    expect(calculateRetryDelay(2, options)).toBe(3_000);
    expect(calculateRetryDelay(3, options)).toBe(5_000);
    expect(options.maxAttempts).toBe(5);
  });

  it("supports bounded full jitter", () => {
    const options = normalizePersistentRetryOptions({
      initialInterval: 1_000,
      jitter: true,
    });

    expect(calculateRetryDelay(1, options, () => 0)).toBe(0);
    expect(calculateRetryDelay(1, options, () => 0.5)).toBe(500);
  });

  it("replaces invalid numeric options with safe defaults", () => {
    const options = normalizePersistentRetryOptions({
      maxAttempts: Number.NaN,
      initialInterval: Number.POSITIVE_INFINITY,
      backoffFactor: -2,
      maxInterval: -1,
    });

    expect(options).toMatchObject({
      maxAttempts: 8,
      initialInterval: 1_000,
      backoffFactor: 1,
      maxInterval: 1_000,
    });
  });

  it("retries ordinary exceptions unless explicitly marked permanent", () => {
    expect(isRetryableError(new RetryableError("temporary"))).toBe(true);
    expect(isRetryableError(new Error("unexpected failure"))).toBe(true);
    expect(isRetryableError("non-Error thrown value")).toBe(true);
    expect(isRetryableError(new NonRetryableError("invalid input"))).toBe(false);
    expect(isRetryableError(Object.assign(new Error("aborted"), { name: "AbortError" }))).toBe(false);
  });

  it("retries a transient node failure up to success", async () => {
    const State = new StateSchema({ value: z.number() });
    let attempts = 0;
    const graph = new StateGraph(State)
      .addNode("unstable", () => {
        attempts += 1;
        if (attempts < 3) throw new RetryableError("try again");
        return { value: 42 };
      })
      .addEdge(START, "unstable")
      .addEdge("unstable", END)
      .setNodeDefaults({
        retryPolicy: {
          ...nodeRetryPolicy,
          initialInterval: 0,
          maxInterval: 0,
          jitter: false,
          logWarning: false,
        },
      })
      .compile({ checkpointer: new MemorySaver() });

    const result = await graph.invoke({ value: 0 }, {
      configurable: { thread_id: "retry-success" },
    });

    expect(attempts).toBe(3);
    expect(result.value).toBe(42);
  });

  it("does not retry a permanent failure", async () => {
    const State = new StateSchema({ value: z.number() });
    let attempts = 0;
    const graph = new StateGraph(State)
      .addNode("invalid", () => {
        attempts += 1;
        throw new NonRetryableError("invalid input");
      })
      .addEdge(START, "invalid")
      .setNodeDefaults({
        retryPolicy: {
          ...nodeRetryPolicy,
          initialInterval: 0,
          jitter: false,
          logWarning: false,
        },
      })
      .compile({ checkpointer: new MemorySaver() });

    await expect(graph.invoke({ value: 0 }, {
      configurable: { thread_id: "retry-permanent" },
    })).rejects.toThrow("invalid input");
    expect(attempts).toBe(1);
  });
});
