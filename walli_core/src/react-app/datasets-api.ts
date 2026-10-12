import type { Category, DataSchema, Dataset, DatasetDetail, DatasetRecord } from "@shared/datasets";
async function request<T>(path = "", method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api/admin/datasets${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = (await response.json()) as { error?: unknown; details?: unknown };
  if (!response.ok)
    throw new Error(
      typeof result.error === "string"
        ? `${result.error}${Array.isArray(result.details) ? `: ${result.details.map((item: unknown) => (typeof item === "string" ? item : JSON.stringify(item))).join("; ")}` : ""}`
        : "Request failed",
    );
  return result as T;
}
const segment = encodeURIComponent;
export const datasetsApi = {
  list: (page = 0, q = "", pageSize: 9 | 10 = 9) =>
    request<{ datasets: Dataset[]; hasMore: boolean }>(
      `?${new URLSearchParams({ page: String(page), q, pageSize: String(pageSize) })}`,
    ),
  get: (id: string) => request<DatasetDetail>(`/${segment(id)}`),
  create: (body: { name: string; description: string }) => request<Dataset>("", "POST", body),
  update: (id: string, body: { name: string; description: string }) =>
    request<Dataset>(`/${segment(id)}`, "PUT", body),
  remove: (id: string) => request(`/${segment(id)}`, "DELETE"),
  bind: (id: string, clientIds: string[]) =>
    request(`/${segment(id)}/clients`, "PUT", { clientIds }),
  saveCategory: (id: string, body: { name: string; schema: DataSchema }, category?: Category) =>
    request(
      `/${segment(id)}/categories${category ? `/${segment(category.id)}` : ""}`,
      category ? "PUT" : "POST",
      { ...body, ...(category ? { expectedVersion: category.version } : {}) },
    ),
  archiveCategory: (id: string, categoryId: string) =>
    request(`/${segment(id)}/categories/${segment(categoryId)}`, "DELETE"),
  versions: (id: string, categoryId: string) =>
    request<{ version: number; schema: DataSchema }[]>(
      `/${segment(id)}/categories/${segment(categoryId)}/versions`,
    ),
  records: (id: string, page: number, q = "") =>
    request<{ records: DatasetRecord[]; hasMore: boolean }>(
      `/${segment(id)}/records?${new URLSearchParams({ page: String(page), q })}`,
    ),
  record: (id: string, recordId: string) =>
    request<DatasetRecord>(`/${segment(id)}/records/${segment(recordId)}`),
  saveRecord: (
    id: string,
    body: {
      categoryId: string | null;
      schemaVersion: number;
      title: string;
      data: Record<string, unknown>;
    },
    record?: DatasetRecord,
  ) =>
    request(
      `/${segment(id)}/records${record ? `/${segment(record.id)}` : ""}`,
      record ? "PUT" : "POST",
      { ...body, ...(record ? { expectedRevision: record.revision } : {}) },
    ),
  setRecordEnabled: (id: string, record: DatasetRecord, enabled: boolean) =>
    request(`/${segment(id)}/records/${segment(record.id)}/enabled`, "PUT", {
      enabled,
      expectedRevision: record.revision,
    }),
  removeRecord: (id: string, recordId: string) =>
    request(`/${segment(id)}/records/${segment(recordId)}`, "DELETE"),
  sync: (id: string) => request(`/${segment(id)}/sync`, "POST"),
};
