import { Hono } from "hono";
import { ragInput } from "@shared/datasets";
import type { AppBindings } from "../api/types";
import { searchDatasets } from "../datasets/search";
import { getAsyncContext } from "../lib/async-context";
export const knowledgeToolRoute = new Hono<AppBindings>().post(
  "/api/tools/knowledge/search",
  async (c) => {
    if (!getAsyncContext().userInfo?.clientId)
      return c.json({ error: "Authenticated client context is required" }, 403);
    const parsed = ragInput.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success)
      return c.json(
        {
          error: "Invalid search input",
          issues: parsed.error.issues.map(({ path, code, message }) => ({ path, code, message })),
          guidance:
            'datasetId must be an exact UUID from the dataset catalog, never a name. Call knowledge_search with {"query":""} and omit datasetId to discover authorized datasets, then retry with a returned id. Alternatively, omit datasetId to search bound datasets. limit must be an integer from 1 to 10; query must be at most 1000 characters.',
        },
        400,
      );
    return c.json(await searchDatasets(parsed.data));
  },
);
