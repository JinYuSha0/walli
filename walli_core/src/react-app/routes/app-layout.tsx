import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { authClient } from "@/auth-client";
import { getMe } from "@/api";
import { useUiStore } from "@/stores/ui-store";

export function AppLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const session = authClient.useSession();
  const setActivePanel = useUiStore((state) => state.setActivePanel);

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    enabled: !!session.data,
    retry: false,
  });

  useEffect(() => {
    if (!session.isPending && !session.data) {
      void navigate({ to: "/login" });
    }
  }, [navigate, session.data, session.isPending]);

  const signOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          queryClient.removeQueries({ queryKey: ["admin-status"] });
          queryClient.removeQueries({ queryKey: ["me"] });
          setActivePanel("overview");
          void navigate({ to: "/login" });
        },
      },
    });
  };

  if (session.isPending || !session.data) {
    return (
      <main className="grid h-svh grid-rows-[auto_1fr] gap-5 overflow-hidden bg-background p-4 lg:p-6">
        <div className="grid gap-3">
          <Skeleton className="h-12 w-52" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>
        <div className="grid min-h-0 gap-4 md:grid-cols-[18rem_1fr]">
          <Skeleton className="hidden h-full w-full md:block" />
          <div className="grid min-h-0 grid-rows-[auto_1fr] gap-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
            </div>
            <Skeleton className="h-full min-h-0 w-full" />
          </div>
        </div>
      </main>
    );
  }

  const user = {
    name: session.data.user.name || session.data.user.email,
    email: session.data.user.email,
    avatar: session.data.user.image ?? "",
  };

  const isForbidden = !meQuery.isPending && meQuery.data?.isAdmin === false;
  const routeTitles: Record<string, string> = {
    "/": t("routeDashboard"),
    "/prompt": t("routeSystemPrompt"),
    "/keys": t("routeKeys"),
  };
  const title = routeTitles[location.pathname] ?? t("routeConsole");

  return (
    <SidebarProvider
      className="h-svh min-h-0 overflow-hidden"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar user={user} onSignOut={signOut} variant="inset" />
      <SidebarInset className="min-h-0 overflow-hidden">
        <SiteHeader title={title} />
        <div className={isForbidden ? "min-h-0 flex-1 overflow-hidden" : "min-h-0 flex-1 overflow-auto"}>
          {meQuery.isPending ? (
            <div className="grid h-full min-h-[calc(100svh-var(--header-height))] grid-rows-[auto_auto_1fr] gap-5 p-4 lg:p-6">
              <div className="grid gap-3">
                <Skeleton className="h-10 w-56" />
                <Skeleton className="h-5 w-80 max-w-full" />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Skeleton className="h-36 w-full" />
                <Skeleton className="h-36 w-full" />
                <Skeleton className="h-36 w-full" />
              </div>
              <Skeleton className="h-full min-h-0 w-full" />
            </div>
          ) : isForbidden ? (
            <Forbidden403 />
          ) : (
            <Outlet />
          )}
        </div>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}

function Forbidden403() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full max-h-full items-center justify-center overflow-hidden p-4 sm:p-6">
      <Card className="max-h-full w-full max-w-3xl overflow-hidden py-6 sm:py-8">
        <div className="flex max-h-full flex-col items-center px-5 text-center sm:px-6">
          <ForbiddenIllustration />
          <h2 className="text-center text-5xl font-semibold leading-none tracking-tight sm:text-6xl">
            {t("forbiddenTitle")}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-center text-sm text-muted-foreground sm:text-base">
            {t("forbiddenDescription")}
          </p>
        </div>
      </Card>
    </div>
  );
}

function ForbiddenIllustration() {
  return (
    <div className="mx-auto mb-2 h-28 w-40 shrink-0 overflow-hidden sm:h-40 sm:w-56">
      <div className="relative h-40 w-56 origin-top-left scale-[0.714] sm:scale-100">
        <div className="absolute inset-x-8 bottom-0 h-24 rounded-t-4xl border border-border bg-muted" />
        <div className="absolute left-1/2 top-8 h-24 w-20 -translate-x-1/2 rounded-t-4xl border border-border bg-background shadow-sm" />
        <div className="absolute left-1/2 top-14 h-8 w-12 -translate-x-1/2 rounded-t-2xl border-4 border-primary/70 border-b-0" />
        <div className="absolute left-1/2 top-20 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
          !
        </div>
        <div className="absolute left-4 top-16 h-3 w-3 rounded-full bg-destructive/80" />
        <div className="absolute right-5 top-10 h-4 w-4 rounded-full bg-primary/30" />
        <div className="absolute right-10 bottom-7 h-2 w-16 rounded-full bg-border" />
      </div>
    </div>
  );
}
