import type { AppSession, AppUser } from "./helper/auth";
import type { Database } from "../db/client";

export type AppBindings = {
  Bindings: Env;
  Variables: {
    db: Database;
    user: AppUser | null;
    session: AppSession | null;
  };
};
