import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export const createDb = (db: D1Database) => drizzle(db, { schema });

export type Database = ReturnType<typeof createDb>;
