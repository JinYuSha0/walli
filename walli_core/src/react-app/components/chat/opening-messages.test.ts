import { expect, it } from "vitest";
import { createOpeningMessages } from "./opening-messages";
const meta = { nickname: "Helper", avatarUrl: "/avatar.png" };
it("uses system messages for notices and assistant messages for replies in order", () => {
  const messages = createOpeningMessages("Hello\n\n:::notice info\nSystem notice\n:::\n\n:::recommended-replies\n- Help\n:::", meta);
  expect(messages.map(({ role }) => role)).toEqual(["assistant", "system", "assistant"]);
  expect(messages[1].meta).toBeUndefined();
  expect(messages[2].meta).toEqual(meta);
  expect(new Set(messages.map(({ id }) => id)).size).toBe(3);
});
it("keeps fenced examples and incomplete notices as assistant content", () => {
  for (const markdown of ["```text\n:::notice info\nExample\n:::\n```", ":::notice info\nStill typing"]) {
    expect(createOpeningMessages(markdown, meta)).toEqual([expect.objectContaining({ role: "assistant", markdown })]);
  }
});
it("returns no messages for an empty opening", () => {
  expect(createOpeningMessages(" \n ", meta)).toEqual([]);
});

it("omits identity metadata when disabled", () => {
  expect(createOpeningMessages("Hello")[0]).not.toHaveProperty("meta");
});

it("inserts plain system messages without assistant identity or container markers", () => {
  const messages = createOpeningMessages("Hello\n\n:::system\nConversation started\n:::\n\nHow can I help?", meta);
  expect(messages.map(({ role }) => role)).toEqual(["assistant", "system", "assistant"]);
  expect(messages[1]).toMatchObject({ markdown: "Conversation started", showActions: false });
  expect(messages[1]).not.toHaveProperty("meta");
});
it("preserves system syntax inside code fences or incomplete input", () => {
  for (const markdown of ["```text\n:::system\nExample\n:::\n```", ":::system\nStill typing"]) {
    expect(createOpeningMessages(markdown)).toEqual([expect.objectContaining({ role: "assistant", markdown })]);
  }
});
