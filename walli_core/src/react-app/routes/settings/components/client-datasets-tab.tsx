import { useDatasetList } from "@/components/datasets/use-dataset-list";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { DatasetSearch, DatasetPagination } from "@/components/datasets/dataset-list-controls";
import { Button } from "@/components/ui/button";
import { RouteLoading } from "../../route-loading";

async function bindings(clientId: string, datasetIds?: string[]) {
  const response = await fetch(`/api/admin/clients/${encodeURIComponent(clientId)}/datasets`, {
    method: datasetIds ? "PUT" : "GET",
    headers: { "content-type": "application/json" },
    body: datasetIds ? JSON.stringify({ datasetIds }) : undefined,
  });
  if (!response.ok) throw new Error("Failed to access dataset bindings");
  return response.json() as Promise<{ datasetIds: string[] }>;
}
export function ClientDatasetsTab({ clientId }: { clientId: string }) {
  const query = useQuery({
    queryKey: ["datasets", "client", clientId],
    queryFn: () => bindings(clientId),
  });
  if (query.isPending) return <RouteLoading />;
  if (query.isError) return <p role="alert">{query.error.message}</p>;
  return <BindingForm key={clientId} clientId={clientId} selected={query.data.datasetIds} />;
}
function BindingForm({ clientId, selected: initial }: { clientId: string; selected: string[] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(initial);
  const [busy, setBusy] = useState(false);
  const { query, page, search, setPage } = useDatasetList(true, 10);
  const datasets = query.data?.datasets ?? [];
  const save = async () => {
    setBusy(true);
    try {
      await bindings(clientId, selected);
      await queryClient.invalidateQueries({ queryKey: ["datasets"] });
      toast.success(t("datasets.saved"));
    } catch {
      toast.error(t("datasets.failed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
        <p className="shrink-0 text-sm text-muted-foreground">{t("datasets.clientHint")}</p>
        <DatasetSearch onSearch={search} />
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-1">
          {query.isPending ? (
            <RouteLoading />
          ) : query.isError ? (
            <p role="alert">{query.error.message}</p>
          ) : (
            datasets.map((dataset) => (
              <div
                key={dataset.id}
                className="flex items-center justify-between gap-4 rounded-lg border p-3"
              >
                <label className="flex flex-1 items-center gap-3">
                  <input
                    type="checkbox"
                    disabled={busy || query.isFetching}
                    checked={selected.includes(dataset.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, dataset.id]
                          : selected.filter((id) => id !== dataset.id),
                      )
                    }
                  />
                  {dataset.name}
                </label>
                <Link
                  to="/datasets/$datasetId"
                  params={{ datasetId: dataset.id }}
                  className="text-sm text-primary"
                >
                  {t("datasets.manage")}
                </Link>
              </div>
            ))
          )}
          {!query.isPending && !query.isError && !datasets.length && (
            <p className="text-sm text-muted-foreground">{t("datasets.noSearchResults")}</p>
          )}
        </div>
        <div className="mt-auto grid shrink-0 grid-cols-1 items-center gap-3 border-t bg-card pt-4 lg:grid-cols-[1fr_auto_1fr]">
          <div className="flex items-center justify-self-end gap-3 lg:col-start-3 lg:row-start-1">
            <Button disabled={busy} onClick={() => void save()}>
              {t("datasets.saveBindings")}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t("datasets.selectedCount", { count: selected.length })}
            </span>
          </div>
          <div className="justify-self-center lg:col-start-2 lg:row-start-1">
          <DatasetPagination
            page={page}
            hasMore={query.data?.hasMore ?? false}
            busy={query.isFetching}
            onPage={setPage}
          />
          </div>
        </div>
    </div>
  );
}
