import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { getAsyncContext } from "@worker/lib/async-context";

export const createDb = () => drizzle(getAsyncContext().env.DB, { schema });

export type Database = ReturnType<typeof createDb>;
