import { lazy, type ComponentType, Suspense } from "react";

import { RouteLoading } from "./route-loading";

const createLazyRoute = (loader: () => Promise<{ default: ComponentType }>) => {
  const Route = lazy(loader);

  return function LazyRoute() {
    return (
      <Suspense fallback={<RouteLoading />}>
        <Route />
      </Suspense>
    );
  };
};

export const LazyDashboardRoute = createLazyRoute(() =>
  import("./dashboard-route").then((module) => ({
    default: module.DashboardRoute,
  }))
);

export const LazyClientsRoute = createLazyRoute(() =>
  import("./keys-route").then((module) => ({
    default: module.ClientsRoute,
  }))
);

export const LazyChatTestRoute = createLazyRoute(() =>
  import("./chat-test-route").then((module) => ({
    default: module.ChatTestRoute,
  }))
);

export const LazyLoginRoute = createLazyRoute(() =>
  import("./login-route").then((module) => ({
    default: module.LoginRoute,
  }))
);

export const LazySettingsRoute = createLazyRoute(() =>
  import("./settings/settings-route").then((module) => ({
    default: module.SettingsRoute,
  }))
);
