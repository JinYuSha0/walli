import { WebChatSidebarHeader } from "./web-chat-sidebar-header";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";
import { UserRound, MoreHorizontal, Trash2, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { WebChatHistorySkeleton } from "./web-chat-loading";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WebChatConfig, WebSession } from "./web-chat-api";

export function WebChatSidebar({
  config,
  sessions,
  selectedId,
  disabled,
  canCreate,
  isPending,
  isError,
  hasNextPage,
  isFetching,
  onSelect,
  onCreate,
  onDelete,
  onLoadMore,
  onRetry,
  onCollapse,
  onSignOut,
  signingOut,
}: {
  config: WebChatConfig;
  sessions: WebSession[];
  selectedId?: string;
  disabled: boolean;
  canCreate: boolean;
  isPending: boolean;
  isError: boolean;
  hasNextPage: boolean;
  isFetching: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onLoadMore: () => void;
  onRetry: () => void;
  onCollapse: () => void;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();


  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <WebChatSidebarHeader
        canCreate={canCreate}
        disabled={disabled}
        onCreate={onCreate}
        onCollapse={onCollapse}
      />
      <h2 className="px-5 pb-2 text-xs font-medium text-muted-foreground">
        {t("webChatSessions")}
      </h2>
      <div
        className="web-chat-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-2 pb-3"
        aria-busy={isFetching}
      >
        {isPending ? (
          <WebChatHistorySkeleton />
        ) : (
          <ul className="grid gap-1">
            {sessions.map((session) => (
              <li
                key={session.id}
                className={`group/session flex min-w-0 items-center rounded-lg transition-colors ${session.id === selectedId ? "bg-muted" : "hover:bg-muted/70 focus-within:bg-muted/70"}`}
              >
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(session.id)}
                  aria-current={session.id === selectedId ? "page" : undefined}
                  title={session.title || t("webChatNewSession")}
                  className="web-chat-session-link flex min-w-0 flex-1 items-center gap-2 rounded-lg py-2.5 pl-3 pr-1 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-100"
                >
                  <span className="truncate">{session.title || t("webChatNewSession")}</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="web-chat-session-menu mr-1 size-7 shrink-0 rounded-md"
                      variant="ghost"
                      size="icon"
                      disabled={disabled}
                      aria-label={t("webChatSessionMenu", {
                        title: session.title || t("webChatNewSession"),
                      })}
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={isMobile ? "end" : "start"} side="bottom">
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={disabled}
                      onSelect={() => onDelete(session.id)}
                    >
                      <Trash2 className="size-4" />
                      {t("webChatDeleteSession")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
        {!isPending && !isError && !sessions.length && (
          <p className="px-3 py-6 text-sm text-muted-foreground">{t("webChatNoSessions")}</p>
        )}
        {isError ? (
          <div className="grid gap-2 px-3 py-3 text-center">
            <p className="text-xs text-muted-foreground" role="alert">
              {t("webChatRequestFailed")}
            </p>
            <Button
              variant="ghost"
              size="sm"
              disabled={isFetching}
              onClick={sessions.length ? onLoadMore : onRetry}
            >
              {t("webChatRetry")}
            </Button>
          </div>
        ) : (
          hasNextPage && (
            <Button
              className="w-full text-xs text-muted-foreground"
              variant="ghost"
              size="sm"
              disabled={isFetching}
              onClick={onLoadMore}
            >
              {t(isFetching ? "webChatLoadingSessions" : "webChatLoadMore")}
            </Button>
          )
        )}
      </div>
      <div className="h-15 shrink-0 p-3">
        <WebChatUserMenu config={config} disabled={disabled || signingOut} onSignOut={onSignOut} />
      </div>
    </div>
  );
}

export function WebChatUserMenu({ config, disabled, onSignOut, collapsed = false }: {
  config: WebChatConfig;
  disabled: boolean;
  onSignOut: () => void;
  collapsed?: boolean;
}) {
  const { t } = useTranslation();
  const userName = config.loginMethod === "google" && config.authenticated
    ? config.userName?.trim()
    : undefined;
  if (!userName) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button"
          className={`flex min-w-0 cursor-pointer items-center gap-3 rounded-lg p-1 text-left outline-none transition-colors hover:bg-muted data-[state=open]:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:hover:bg-transparent ${collapsed ? "shrink-0" : "w-full"}`}
          disabled={disabled} aria-label={userName} title={collapsed ? userName : undefined}>
          <Avatar>
            <AvatarImage src={config.userImage || undefined} alt="" referrerPolicy="no-referrer" />
            <AvatarFallback><UserRound className="size-5" /></AvatarFallback>
          </Avatar>
          {!collapsed && <span className="min-w-0 truncate text-sm font-medium" title={userName}>{userName}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side={collapsed ? "right" : "top"}>
        <DropdownMenuItem onSelect={onSignOut} disabled={disabled}>{t("webChatSignOut")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function WebChatThemeToggle() {
  const { t } = useTranslation();
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const label = t(dark ? "themeLight" : "themeDark");
  return (
    <Button
      className="shrink-0 rounded-full border border-border/40 bg-background/60 shadow-sm backdrop-blur-md hover:bg-background/80 md:rounded-lg md:border-0 md:bg-transparent md:shadow-none md:backdrop-blur-none md:hover:bg-accent"
      variant="ghost"
      size="icon"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={label}
      title={label}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
