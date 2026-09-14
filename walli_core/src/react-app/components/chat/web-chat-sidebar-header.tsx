import { MessageSquare, PanelLeftClose, SquarePen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function WebChatSidebarHeader({
  canCreate = true,
  disabled = false,
  onCreate,
  onCollapse,
}: {
  canCreate?: boolean;
  disabled?: boolean;
  onCreate?: () => void;
  onCollapse?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="shrink-0 px-2 pt-3 pb-5" inert={!onCreate && !onCollapse}>
      <div className="mb-2 flex h-9 items-center justify-between px-2 pr-12 md:pr-0">
        <MessageSquare className="size-5" aria-hidden="true" />
        <Button
          className="hidden shrink-0 md:inline-flex"
          variant="ghost"
          size="icon"
          onClick={onCollapse}
          aria-label={t("webChatCollapseSidebar")}
          title={t("webChatCollapseSidebar")}
          aria-expanded={true}
          aria-controls="web-chat-desktop-sidebar"
        >
          <PanelLeftClose className="size-4" />
        </Button>
      </div>
      <div className="h-10">
        {canCreate && (
          <Button
            className="web-chat-new-session h-10 w-full justify-start gap-3 rounded-lg px-3 hover:bg-muted disabled:opacity-100"
            variant="ghost"
            disabled={disabled}
            onClick={onCreate}
          >
            <SquarePen className="size-4" />
            {t("webChatNewSession")}
          </Button>
        )}
      </div>
    </div>
  );
}
