import type { Token } from "marked";
import type { InlineVariant, ParseContext, PreparedBlock, PreparedBlockBase } from "./type";
import { getCommonStyle } from "./styles";

export type ImageDimensions = {
  height?: number;
  width?: number;
};

const WIDTH_ATTRIBUTE_RE = /\bwidth=["']?(\d+(?:\.\d+)?)(?:px)?["']?/;
const HEIGHT_ATTRIBUTE_RE = /\bheight=["']?(\d+(?:\.\d+)?)(?:px)?["']?/;

export function parseMarkdownHref(href: string | null | undefined): string | undefined {
  if (href === undefined || href === null) return;
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return;
  }
}

export function parseMarkdownImageSrc(src: string | null | undefined): string | undefined {
  if (src === undefined || src === null) return;
  try {
    const url = new URL(src);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "blob:"
      ? url.href
      : undefined;
  } catch {
    return;
  }
}

export function parseImageDimensions(token: Token | undefined): ImageDimensions | null {
  if (token?.type !== "text") return null;

  const source = token.text.trim();
  if (!source.startsWith("{") || !source.endsWith("}")) return null;

  const attributes = source.slice(1, -1);
  const width = readDimension(attributes, WIDTH_ATTRIBUTE_RE);
  const height = readDimension(attributes, HEIGHT_ATTRIBUTE_RE);
  return width === undefined && height === undefined ? null : { height, width };
}

function readDimension(source: string, pattern: RegExp): number | undefined {
  const value = Number(pattern.exec(source)?.[1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export function fallbackTextForToken(token: Token): string {
  if ("text" in token && typeof token.text === "string") return token.text;
  return token.raw ?? "";
}

export function headingVariant(depth: number): InlineVariant {
  if (depth <= 1) return "h1";
  if (depth === 2) return "h2";
  return "body";
}

export function createBlockBase(ctx: ParseContext): PreparedBlockBase {
  const listIndent = Math.max(0, ctx.listDepth - 1) * getCommonStyle("listNestingIndent");
  const contentLeft = listIndent + ctx.quoteDepth * getCommonStyle("blockQuoteIndent");
  const quoteRailLefts: number[] = [];

  for (let depth = 0; depth < ctx.quoteDepth; depth++) {
    quoteRailLefts.push(
      listIndent + depth * getCommonStyle("blockQuoteIndent") + getCommonStyle("railOffset"),
    );
  }

  return {
    contentLeft,
    marginTop: 0,
    markerClassName: null,
    markerLeft: null,
    markerText: null,
    quoteRailLefts,
  };
}

export function appendBlockGroup(
  target: PreparedBlock[],
  group: PreparedBlock[],
  space: number,
): void {
  if (group.length === 0) return;

  for (let index = 0; index < group.length; index++) {
    const block = group[index]!;
    target.push({
      ...block,
      marginTop: index === 0 ? (target.length === 0 ? 0 : space) : block.marginTop,
    } satisfies PreparedBlock);
  }
}

export class TimeScheduler<T = string> {
  private static instance: TimeScheduler;
  private tasks: Map<string, { timestamp: number; execute: () => void }>;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private taskIdCounter: number;
  private lastCheckTime: number;
  // Tracks the latest task ID registered for each task type.
  private lastTaskByType: Map<T, string>;

  public constructor() {
    this.tasks = new Map();
    this.taskIdCounter = 0;
    this.lastCheckTime = Date.now();
    this.lastTaskByType = new Map();
  }

  public static getInstance() {
    if (!TimeScheduler.instance) {
      TimeScheduler.instance = new TimeScheduler();
    }
    return TimeScheduler.instance;
  }

  /** Starts the underlying timer. */
  private startTimer(): void {
    if (this.timer) return;

    const checkTasks = () => {
      const now = Date.now();
      const timeDiff = now - this.lastCheckTime;

      // Check more frequently after a long event-loop pause or scheduling delay.
      const nextInterval = timeDiff > 200 ? 50 : 100;

      // Execute every task whose scheduled time has passed.
      this.tasks.forEach((task, taskId) => {
        if (task.timestamp <= now) {
          try {
            task.execute();
          } catch (error) {
          } finally {
            this.tasks.delete(taskId);

            for (const [type, id] of this.lastTaskByType.entries()) {
              if (id === taskId) {
                this.lastTaskByType.delete(type);
                break;
              }
            }
          }
        }
      });

      this.lastCheckTime = now;

      // Keep the timer alive while scheduled tasks remain.
      if (this.tasks.size > 0) {
        this.timer = setTimeout(checkTasks, nextInterval);
      } else {
        this.timer = null;
      }
    };

    this.timer = setTimeout(checkTasks, 100);
  }

  /**
   * Schedules a task.
   * @param timestamp Execution time as a Unix timestamp in milliseconds.
   * @param execute Task callback.
   * @returns The scheduled task ID.
   */
  public schedule(timestamp: number, execute: () => void): string {
    const taskId = `task_${++this.taskIdCounter}`;
    this.tasks.set(taskId, { timestamp, execute });

    // Start the timer when the first task is added.
    if (this.tasks.size === 1) {
      this.startTimer();
    }

    return taskId;
  }

  /**
   * Schedules a task and cancels the previously scheduled task of the same type.
   * @param type Task type.
   * @param timestamp Execution time as a Unix timestamp in milliseconds.
   * @param execute Task callback.
   * @returns The scheduled task ID.
   */
  public scheduleByType(type: T, timestamp: number, execute: () => void): string {
    // Cancel the previously scheduled task of the same type.
    const lastTaskId = this.lastTaskByType.get(type);
    if (lastTaskId) {
      this.cancel(lastTaskId);
    }

    // Schedule the replacement task.
    const taskId = this.schedule(timestamp, execute);

    // Track the replacement task ID.
    this.lastTaskByType.set(type, taskId);

    return taskId;
  }

  /**
   * Cancels a task.
   * @param taskId Scheduled task ID.
   */
  public cancel(taskId: string): void {
    this.tasks.delete(taskId);

    // Remove the matching task type entry.
    for (const [type, id] of this.lastTaskByType.entries()) {
      if (id === taskId) {
        this.lastTaskByType.delete(type);
        break;
      }
    }

    // Stop the timer when no scheduled tasks remain.
    if (this.tasks.size === 0 && this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Cancels the scheduled task for a type.
   * @param type Task type.
   */
  public cancelByType(type: T): void {
    const taskId = this.lastTaskByType.get(type);
    if (taskId) {
      this.cancel(taskId);
    }
  }

  /**
   * Cancels all scheduled tasks.
   */
  public cancelAll(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.tasks.clear();
    this.lastTaskByType.clear();
  }

  /**
   * Destroys the scheduler and cancels all scheduled tasks.
   */
  public destroy(): void {
    this.cancelAll();
  }
}

// Shared scheduler instance.
export const timeScheduler = TimeScheduler.getInstance();
