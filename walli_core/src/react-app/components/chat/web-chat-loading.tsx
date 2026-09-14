import { WebChatSidebarHeader } from "./web-chat-sidebar-header";
import { useTranslation } from "react-i18next";
import { WalliLoading } from "@wallilabs/chat/react";
import "@wallilabs/chat/theme.css";
import "./web-chat.css";

export function WebChatHistorySkeleton() {
  const { t } = useTranslation();
  return (
    <div className="grid gap-1 px-3" role="status" aria-label={t("webChatLoadingSessions")}>
      {["82%", "64%", "91%", "72%", "58%", "85%"].map((width, index) => (
        <div key={index} className="flex h-10 items-center" aria-hidden="true">
          <div className="web-chat-history-skeleton h-3 rounded-full" style={{ width }} />
        </div>
      ))}
    </div>
  );
}

export function WebChatLoading() {
  const { t } = useTranslation();
  return (
    <div className="web-chat-loading relative flex h-dvh overflow-hidden bg-background text-foreground">
      <aside
        className="web-chat-sidebar hidden h-full shrink-0 bg-muted/40 md:block"
        aria-label={t("webChatSessions")}
      >
        <div className="flex h-full min-h-0 w-full flex-col">
          <WebChatSidebarHeader />
          <h2 className="px-5 pb-2 text-xs font-medium text-muted-foreground">
            {t("webChatSessions")}
          </h2>
          <div className="web-chat-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-2 pb-3">
            <WebChatHistorySkeleton />
          </div>
          <div className="h-15 shrink-0" aria-hidden="true" />
        </div>
      </aside>
      <div className="web-chat-main relative grid flex-1 place-items-center">
        <WalliLoading ariaLabel={t("webChatLoadingSessions")} />
      </div>
    </div>
  );
}
