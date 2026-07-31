export type ChatMessageStatus = "idle" | "thinking" | "streaming" | "done" | "error" | "cancelled";

export interface ChatMessage {
  id: string;

  role: "user" | "assistant" | "system";

  parts: ChatMessagePart[];

  status: ChatMessageStatus;

  createdAt?: number;

  error?: ChatMessageError;
}

export type ChatMessagePart =
  | ChatTextPart
  | ChatReasoningPart
  | ChatImagePart
  | ChatFilePart
  | ChatToolPart
  | ChatCitationPart
  | ChatErrorPart;

export interface ChatTextPart {
  type: "text";
  text: string;
}

export interface ChatReasoningPart {
  type: "reasoning";
  text: string;

  status?: "streaming" | "done";

  /**
   * 是否展开
   */
  expanded?: boolean;
}

export interface ChatImagePart {
  type: "image";
  url: string;
  alt?: string;

  width?: number;
  height?: number;

  loading?: boolean;
}

export interface ChatFilePart {
  type: "file";

  name: string;
  url?: string;

  mimeType?: string;
  size?: number;

  status?: "uploading" | "ready" | "error";

  progress?: number;
}

export interface ChatToolPart {
  type: "tool";

  id: string;
  name: string;

  /**
   * UI 展示标题
   */
  title?: string;

  /**
   * 输入参数
   */
  input?: unknown;

  /**
   * 输出结果
   */
  output?: unknown;

  status: "pending" | "running" | "success" | "error";

  expanded?: boolean;
}

export interface ChatCitationPart {
  type: "citation";

  title?: string;
  url?: string;
  source?: string;
}

export interface ChatErrorPart {
  type: "error";

  message: string;

  retryable?: boolean;
}

export interface ChatMessageError {
  message: string;
  retryable?: boolean;
}

export type ChatHistoryMessageStatus = "done" | "error" | "cancelled";

export interface ChatHistoryMessage {
  id: string;

  role: "user" | "assistant" | "system";

  parts: ChatHistoryMessagePart[];

  status?: ChatHistoryMessageStatus;

  createdAt?: number;

  metadata?: ChatHistoryMessageMetadata;
}

export interface ChatHistoryMessageMetadata {
  provider?: string;
  model?: string;
  raw?: unknown;
}

export type ChatHistoryMessagePart =
  | ChatHistoryTextPart
  | ChatHistoryReasoningPart
  | ChatHistoryImagePart
  | ChatHistoryFilePart
  | ChatHistoryToolCallPart
  | ChatHistoryToolResultPart
  | ChatHistoryCitationPart
  | ChatHistoryErrorPart;

export interface ChatHistoryTextPart {
  type: "text";
  text: string;
  format?: "plain" | "markdown";
}

export interface ChatHistoryReasoningPart {
  type: "reasoning";
  text: string;
}

export interface ChatHistoryImagePart {
  type: "image";
  url: string;
  alt?: string;

  width?: number;
  height?: number;
}

export interface ChatHistoryFilePart {
  type: "file";

  name: string;
  url?: string;

  mimeType?: string;
  size?: number;
}

export interface ChatHistoryToolCallPart {
  type: "tool-call";

  toolCallId: string;
  name: string;

  title?: string;
  input?: unknown;
}

export interface ChatHistoryToolResultPart {
  type: "tool-result";

  toolCallId: string;
  name?: string;

  output?: unknown;
  isError?: boolean;
}

export interface ChatHistoryCitationPart {
  type: "citation";

  title?: string;
  url?: string;
  source?: string;
}

export interface ChatHistoryErrorPart {
  type: "error";

  message: string;

  retryable?: boolean;
}
