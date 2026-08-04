import "../web-components";
import { createElement, useEffect, useRef, type CSSProperties, type ReactElement } from "react";
import type { WalliChatElement } from "../web-components";
import type { WalliChatMessage } from "../types";

export type WalliChatProps = {
  className?: string;
  messages: readonly WalliChatMessage[];
  style?: CSSProperties;
};

export function WalliChat({ className, messages, style }: WalliChatProps): ReactElement {
  const ref = useRef<WalliChatElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.messages = messages;
    }
  }, [messages]);

  return createElement("walli-chat", {
    className,
    ref,
    style,
  });
}

export type { WalliChatMessage };
