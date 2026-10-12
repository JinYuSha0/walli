# Datasets and RAG

The admin console exposes `/datasets` and `/datasets/:datasetId`. Creation uses dedicated pages at `/datasets/:datasetId/models/new` and `/datasets/:datasetId/records/new`; successful saves return to the corresponding dataset tab. A dataset contains models with versioned field definitions and records. The model builder adds string, number, boolean, date/time, and Markdown rich-text fields with required and range/length constraints. React Hook Form validates record forms; the Worker independently validates the same schema. Tiptap edits rich text and serializes it as Markdown. Records without a selected model use a Markdown body. Client access can be edited from either the dataset's **Client access** tab or a client's **Datasets** tab. Grants are many-to-many.

## Models and forms

Date/time inputs use the browser's local timezone and persist ISO timestamps with a timezone. Required booleans accept `false`, and numeric fields accept zero. Optional fields may be omitted. Model changes retain immutable versions; editing a record validates against the current version. Removed values require explicit removal before saving, and switching models asks before discarding entered values. Existing nested fields and enums remain supported; the visual builder preserves their definitions.

The existing `categories` API paths and SQL table names remain for compatibility. Model-free records use a private immutable Markdown definition per dataset, hidden from model management; the records API exposes `categoryId: null`. No database table migration is needed for this UI and format extension. Markdown strings are uploaded as readable text, without JSON-escaped line breaks.

## Storage and schema evolution

All runtime database access uses the shared Drizzle client and typed schema, including CRUD, client grants, retrieval authorization, and queue leases. Dependent writes use Drizzle's D1 batch API so records and outbox jobs commit or roll back together. Parameterized `sql` expressions are limited to computed values and SQLite-specific expressions such as JSON membership; large grant and candidate lists use one JSON parameter. Native SQLite access in tests is limited to the D1 adapter, fixtures, and failure injection.

D1 is the source of truth. `dataset`, `client_dataset`, `dataset_category`, `dataset_schema`, `dataset_record`, and `dataset_search_job` hold metadata, grants, immutable schema versions, records, and durable indexing work.

The first release accepts a bounded JSON Schema subset: object, array, string, number, integer, boolean, descriptions, required properties, primitive enums, numeric bounds, and string length bounds. The root must be an object. All object properties must be declared, even when `additionalProperties` is omitted. References, regex patterns, executable validators, unions, defaults and coercion are not supported. Unknown keywords are rejected. Schemas allow up to five nested levels and 50 properties per object; arrays accept at most 100 items, and record JSON is limited to 16,000 characters. API request bodies are limited to 64 KiB.

Publishing an edited category creates a new schema version using optimistic concurrency. Existing records retain their original schema version and JSON. Saving an existing record validates against the latest selected category schema and explicitly upgrades that record. There is no automatic lossy conversion or bulk data migration. Archiving a category disables new writes while retaining schema history and existing searchable records. Dataset deletion immediately revokes access and queues permanent deletion. The consumer waits for active upload leases, deletes the dedicated AI Search instance (including its indexed content), then physically deletes the D1 dataset. Foreign-key cascades atomically delete its records, models, schema versions, grants, and sync jobs. The deletion marker is temporary retry state, not permanent retention. Provider failures retain that state for Queue retry/DLQ recovery; POST to the dataset sync endpoint can republish pending cleanup. A missing remote instance is treated as already deleted. Individual record deletion still hides the record and queues item cleanup.

## AI Search setup

`wrangler.toml` defines a dedicated `DATASET_SEARCH` namespace binding named `walli-datasets` and a `DATASET_SYNC_QUEUE` producer/consumer binding. Wrangler creates the namespace on deployment if necessary. Each dataset receives its own server-generated AI Search instance, provisioned lazily by the first indexing job. Instances use built-in storage with vector and keyword indexes. No R2 data-source bridge or client-supplied instance identifier is used.

Before the first `pnpm dev`, create the namespace in the account used by Wrangler:

```sh
pnpm wrangler ai-search namespace create walli-datasets
```

Local development establishes a remote preview connection for AI Search. Unlike deployment, starting Vite does not provision the namespace. If startup fails at `edge-preview` with code `10359`, check the detailed error for the missing namespace and create it in the same account. D1 and Queue remain local with the current configuration; AI Search operations use the real remote namespace.

Keep the namespace and every instance private. **Never enable public namespace endpoints, public instance endpoints, or an alternative public MCP endpoint for this namespace.** Instance provisioning and synchronization explicitly disable public instance endpoints. Account administrators must also keep the namespace endpoint disabled; enabling one outside this application can bypass application grants.

AI Search requires Cloudflare connectivity and available account capacity. There is no local vector-search emulator or lexical fallback presented as semantic search. UI and D1 operations can run while AI Search is unavailable; records show queued/error states and synchronization retries. Local development with real AI Search should use a separate namespace and an explicitly configured remote binding. It can incur provider usage.

The project uses a single initial D1 migration during development. The new tables are included in `migrations/0000_initial.sql`, its snapshot, and the Drizzle schema. **An existing database that already applied the original initial migration will not acquire the new tables by re-running migrations.** Before deployment to an existing database, apply a reviewed additive schema update containing the new tables and indexes. Do not reset or delete database data. This feature does not automatically apply changes to local or remote databases.

## Durable synchronization

Record writes and outbox inserts use a D1 batch transaction. Each immutable record revision has a distinct document key and job. Workers claim jobs with a lease, recover lost upload responses by key, persist remote item IDs, poll indexing state, and retry with capped exponential backoff. Queue messages dispatch dataset-scoped outbox pages and process individual jobs. There is no cron or idle polling. Indexing checks use delayed messages; provider failures use Queue retries with capped exponential backoff. After five retries, failed deliveries go to `walli-dataset-sync-dlq`. An admin **Retry sync** action republishes outstanding work, including jobs whose delivery reached the DLQ. Uploads and deletes are idempotent under duplicate delivery.

Create both queues before deployment:

```sh
pnpm wrangler queues create walli-dataset-sync
pnpm wrangler queues create walli-dataset-sync-dlq
```

D1 commits and Queue publication are separate operations. The API awaits publication after committing the record and outbox transaction. If publication fails, it returns HTTP 503 with `persisted: true` and `retryUrl`: the write has already been saved, so retry synchronization rather than creating the record again. This also recovers a crash between commit and publication; outstanding D1 work remains available to the admin retry action. There is no automatic periodic recovery scanner. The admin-only `POST /api/admin/datasets/:datasetId/sync` endpoint remains available for deleted datasets to recover cleanup delivery failures. Monitor the DLQ and recover retained D1 jobs with this endpoint after fixing provider/configuration failures. Upload completion is distinct from searchable status.

Edits queue cleanup of old revisions. Deletes queue remote document deletion. Search results are accepted only when their D1 job is ready, their revision is still current, and the dataset/record is active. During synchronization, a recent record may temporarily be absent from search. Historical D1 rows and empty AI Search instances are retained; this first release does not implement retention purges or automatic instance destruction.

## Access boundary and LLM tool

`knowledge_search` is a default built-in tool with `query`, optional `datasetId`, and `limit` (1–10). An empty query lists the current client's dataset catalog. A client with more than ten bound datasets must select one dataset before searching, keeping fan-out bounded. Searches use hybrid retrieval and return up to 24,000 serialized characters of complete D1 records with stable citations. They are not exhaustive and must not be used for counts or aggregation.

The tool reads the client ID only from trusted chat async context. It does not accept `clientId`, instance names, access filters, or record IDs from the model. Direct bearer-token calls without chat context fail closed. All catalog and instance selection queries join current D1 grants. Following remote search, one D1 query revalidates bindings, dataset ownership, deletion state and record revision. A grant revoked while retrieval is running therefore removes that dataset's results before return. Already-delivered chat messages cannot be retroactively revoked.

AI Search is used only for candidate retrieval, not answer generation. Provider snippets and generated answers never reach the model; full records are loaded from D1 after validation. Returned records are untrusted reference material, and the tool instructs the model to cite them rather than follow embedded instructions. All dataset management APIs require the existing admin session.

## Verification

`src/worker/api/datasets.test.ts` exercises the real route/service code against SQLite and a mocked AI Search binding: schema versions, optimistic updates, nested validation, many-to-many access, cross-dataset rejection, forged tool identities, revocation during retrieval, stale/deleted hits, atomic outbox writes, leases, retry recovery and provisioning options.

A production smoke test still needs a real Cloudflare account: create a dataset and category, add a record, wait for `Searchable`, bind client A, query through A, verify client B cannot retrieve it, then unbind A and delete the record. Mocked provider tests do not establish real provider indexing latency or account provisioning permissions.

## Dataset discovery

The dataset homepage and client dataset picker share server-side search and pagination. `GET /api/admin/datasets?page=0&q=term` returns `{ datasets, hasMore }`, with 9 datasets per page by default. The client picker requests `pageSize=10`; accepted page sizes are 9 and 10. Search matches literal substrings in names and descriptions; deleted datasets are excluded. Client selections are independent of the visible page and search filter, so saving preserves off-page grants.

## Record browsing

Each record has an enabled switch, defaulting to true. Disabling retains the record and its editable content, immediately excludes it from authorized RAG results, and queues removal of indexed revisions. Editing a disabled record does not upload it. Re-enabling creates a fresh revision for indexing. Toggle requests require the expected record revision and commit the state change and synchronization jobs atomically. Existing databases need the additive `enabled integer NOT NULL DEFAULT true` column on `dataset_record` before deploying this feature.

The record list shows only the string-valued name field, falling back to the record title. Clicking a name opens a read-only dialog with individual typed fields and rendered Markdown, including linked images. Delete and synchronization status are available in that dialog. Editing opens `/datasets/:datasetId/records/:recordId/edit`, reusing the creation form with server-loaded record data and revision checks; direct navigation and refresh are supported. The records endpoint returns the immutable schema stored with each record so older revisions retain their original display semantics. `GET /api/admin/datasets/:datasetId/records?page=0&q=term` returns ten records per page and `hasMore`. Search matches literal substrings in the record title or string-valued top-level `name` field, restricted to active records in the requested dataset. Changing the search resets the page.

Dataset writes load only the selected model and current schema version; binding validation selects only requested clients. All runtime queries and cascade deletes use Drizzle.

During Vite development, loading the admin record list republishes up to 50 due pending/indexing jobs whose leases have expired. This recovers local Queue messages lost during runtime restarts while retaining D1 outbox state. Active leases and provider-error retry budgets are preserved. Production builds do not run this read-triggered recovery. The record preview reflects the latest polled synchronization status rather than retaining the status from when it was opened.
