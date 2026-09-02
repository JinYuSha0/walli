import type { UIMessageChunk } from "ai";

export { createStorySseStream } from "../stories/ChatMessage.stories";

type TimedChunk = UIMessageChunk & { delay: number };

export function createReasoningStorySseStream(): ReadableStream<string> {
  const reasoning = [
    "Inspecting the request and separating temporary reasoning from the final answer. ",
    "I should verify how the stream changes state, how the reasoning block is measured, ",
    "and whether completed tool calls disappear without removing the reasoning history. ",
    "Next I will organize the answer so the visible result stays concise while this longer ",
    "reasoning section exercises wrapping, scrolling, and collapse-height recalculation.",
  ].join("");
  const chunks: TimedChunk[] = [
    { delay: 0, type: "reasoning-start", id: "reasoning-1" },
    ...(reasoning.match(/[\s\S]{1,7}/g) ?? []).map((delta): TimedChunk => ({
      delay: 140,
      type: "reasoning-delta",
      id: "reasoning-1",
      delta,
    })),
    { delay: 100, type: "reasoning-end", id: "reasoning-1" },
    {
      delay: 100,
      type: "tool-input-available",
      toolCallId: "reasoning-search",
      toolName: "web_search",
      input: { query: "reasoning UI" },
    },
    {
      delay: 200,
      type: "tool-output-available",
      toolCallId: "reasoning-search",
      output: { results: 1 },
    },
    { delay: 900, type: "text-start", id: "text-1" },
    {
      delay: 500,
      type: "text-delta",
      id: "text-1",
      delta: "Here is the final answer. ",
    },
    {
      delay: 80,
      type: "text-delta",
      id: "text-1",
      delta: "Reasoning was temporary; this text remains in the message.",
    },
    { delay: 0, type: "text-end", id: "text-1" },
    { delay: 0, type: "finish" },
  ];
  let index = 0;

  return new ReadableStream<string>({
    async pull(controller) {
      const chunk = chunks[index++];
      if (chunk === undefined) {
        controller.enqueue("data: [DONE]\n\n");
        controller.close();
        return;
      }
      await new Promise<void>((resolve) => window.setTimeout(resolve, chunk.delay));
      const { delay: _delay, ...data } = chunk;
      controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
    },
  });
}
