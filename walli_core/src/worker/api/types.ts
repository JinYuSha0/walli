import type { AppSession, AppUser } from "./auth";

export type AppBindings = {
  Bindings: Env;
  Variables: {
    user: AppUser | null;
    session: AppSession | null;
  };
};
