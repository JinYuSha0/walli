import { createOpeningMessages } from "./opening-messages";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { WalliChat } from "@wallilabs/chat/react";
import "@wallilabs/chat/theme.css";
import "./blocks";

export function OpeningPreview({
  markdown,
  identityEnabled,
  nickname,
  avatar,
}: {
  markdown: string;
  identityEnabled: boolean;
  nickname: string;
  avatar: string;
}) {
  const { t } = useTranslation();
  const messages = useMemo(
    () => createOpeningMessages(markdown, identityEnabled && nickname.trim() ? { nickname, avatarUrl: avatar } : undefined),
    [markdown, identityEnabled, nickname, avatar],
  );
  return (
    <div className="h-96 min-w-0 overflow-hidden rounded-lg border border-border bg-background">
      <WalliChat
        responsive="sm"
        className="block h-full w-full [&::part(viewport)]:[scrollbar-width:none]"
        messages={messages}
        emptyContent={
          <p className="p-4 text-sm text-muted-foreground">{t("chatOpeningPreviewEmpty")}</p>
        }
      />
    </div>
  );
}
