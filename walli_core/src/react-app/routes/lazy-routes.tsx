import { lazy, type ComponentType, type ReactNode, Suspense } from "react";

import { WebChatLoading } from "@/components/chat/web-chat-loading";
import { RouteLoading } from "./route-loading";

const createLazyRoute = (
  loader: () => Promise<{ default: ComponentType }>,
  fallback: ReactNode = <RouteLoading />,
) => {
  const Route = lazy(loader);

  return function LazyRoute() {
    return (
      <Suspense fallback={fallback}>
        <Route />
      </Suspense>
    );
  };
};

export const LazyDashboardRoute = createLazyRoute(() =>
  import("./dashboard-route").then((module) => ({
    default: module.DashboardRoute,
  })),
);

export const LazyClientsRoute = createLazyRoute(() =>
  import("./keys-route").then((module) => ({
    default: module.ClientsRoute,
  })),
);

export const LazyLoginRoute = createLazyRoute(() =>
  import("./login-route").then((module) => ({
    default: module.LoginRoute,
  })),
);

export const LazySettingsRoute = createLazyRoute(() =>
  import("./settings/settings-route").then((module) => ({
    default: module.SettingsRoute,
  })),
);

export const LazyWebChatRoute = createLazyRoute(
  () => import("./web-chat-route").then((module) => ({ default: module.WebChatRoute })),
  <WebChatLoading />,
);
