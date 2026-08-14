export type ServerSentEvent = {
  data: string;
  event: string;
};

export function parseEventData<T>(event: ServerSentEvent): T | null {
  try {
    return JSON.parse(event.data) as T;
  } catch {
    return null;
  }
}

export class ServerSentEventParser {
  private buffer = "";
  private pendingCarriageReturn = false;

  push(chunk: string): ServerSentEvent[] {
    let input = this.pendingCarriageReturn ? `\r${chunk}` : chunk;
    this.pendingCarriageReturn = input.endsWith("\r");
    if (this.pendingCarriageReturn) input = input.slice(0, -1);
    this.buffer += input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const events: ServerSentEvent[] = [];
    let boundary = this.buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const record = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);
      const event = parseRecord(record);
      if (event !== null) events.push(event);
      boundary = this.buffer.indexOf("\n\n");
    }
    return events;
  }

  finish(): ServerSentEvent[] {
    if (this.pendingCarriageReturn) {
      this.buffer += "\n";
      this.pendingCarriageReturn = false;
    }
    const record = this.buffer;
    this.buffer = "";
    const event = parseRecord(record);
    return event === null ? [] : [event];
  }
}

function parseRecord(record: string): ServerSentEvent | null {
  if (record.length === 0) return null;
  let event = "message";
  const data: string[] = [];
  for (const line of record.split("\n")) {
    if (line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator < 0 ? line : line.slice(0, separator);
    let value = separator < 0 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    if (field === "data") data.push(value);
  }
  return data.length === 0 ? null : { data: data.join("\n"), event };
}
