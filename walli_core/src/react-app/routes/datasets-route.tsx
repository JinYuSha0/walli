import { RecordFields } from "@/components/datasets/record-fields";
import { useDatasetList } from "@/components/datasets/use-dataset-list";
import { useState, type FormEvent } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useParams, useNavigate, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Plus, Database, ArrowLeft, Pencil, Trash2, RefreshCw } from "lucide-react";
import { useSave } from "@/components/datasets/use-save";
import { ModelForm, ModelFieldsSummary } from "@/components/datasets/model-forms";
import { DatasetSearch, DatasetPagination } from "@/components/datasets/dataset-list-controls";
import { datasetsApi } from "@/datasets-api";
import { getClients } from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TextEditor } from "@/components/ui/text_editor";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RouteLoading } from "./route-loading";
import {
  type Category,
  type Dataset,
  type DatasetDetail,
  type DatasetRecord,
} from "@shared/datasets";

function DatasetForm({ dataset, close }: { dataset?: Dataset; close: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(dataset?.name ?? "");
  const [description, setDescription] = useState(dataset?.description ?? "");
  const { busy, run } = useSave();
  const navigate = useNavigate();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const result = dataset
        ? await datasetsApi.update(dataset.id, { name, description })
        : await datasetsApi.create({ name, description });
      if (!dataset)
        await navigate({ to: "/datasets/$datasetId", params: { datasetId: result.id } });
    }, close);
  };
  return (
    <form onSubmit={submit} className="grid gap-4">
      <Label htmlFor="dataset-name">{t("datasets.name")}</Label>
      <Input
        id="dataset-name"
        required
        maxLength={100}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Label htmlFor="dataset-description">{t("datasets.description")}</Label>
      <TextEditor
        id="dataset-description"
        maxLength={1000}
        value={description}
        onChange={setDescription}
      />
      <Button disabled={busy || !name.trim()}>{t("datasets.save")}</Button>
    </form>
  );
}
export function DatasetsRoute() {
  const { t } = useTranslation();
  const params = useParams({ strict: false });
  const datasetId = "datasetId" in params ? params.datasetId : undefined;
  const [creating, setCreating] = useState(false);
  const { query, page, q, search, setPage } = useDatasetList(!datasetId);
  if (datasetId) return <DatasetPage key={datasetId} id={datasetId} />;
  if (query.isPending) return <RouteLoading />;
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("datasets.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("datasets.descriptionText")}</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus />
          {t("datasets.create")}
        </Button>
      </div>
      <DatasetSearch onSearch={search} />
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {query.isError ? (
          <p role="alert">{query.error.message}</p>
        ) : (
          <div className="grid w-full max-w-4xl grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {query.data?.datasets.map((dataset) => (
              <Link
                key={dataset.id}
                to="/datasets/$datasetId"
                params={{ datasetId: dataset.id }}
                className="min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Card
                  size="sm"
                  className="rounded-xl transition-colors hover:bg-muted/40 hover:ring-primary/30"
                >
                  <CardHeader className="gap-3">
                    <CardTitle className="flex min-w-0 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Database className="size-4" />
                      </span>
                      <span className="truncate" title={dataset.name}>
                        {dataset.name}
                      </span>
                    </CardTitle>
                    <CardDescription className="line-clamp-2 min-h-10 break-words text-sm leading-5">
                      {dataset.description || t("datasets.noDescription")}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
        {!query.isError && !query.data?.datasets.length && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {t(q || page > 0 ? "datasets.noSearchResults" : "datasets.empty")}
            </CardContent>
          </Card>
        )}
      </div>
      <div className="flex shrink-0 justify-center border-t bg-background pt-4">
        <DatasetPagination
          page={page}
          hasMore={query.data?.hasMore ?? false}
          busy={query.isFetching}
          onPage={setPage}
        />
      </div>
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("datasets.create")}</DialogTitle>
            <DialogDescription>{t("datasets.descriptionText")}</DialogDescription>
          </DialogHeader>
          <DatasetForm close={() => setCreating(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
function DatasetPage({ id }: { id: string }) {
  const hash = useLocation({ select: (location) => location.hash });
  const { t } = useTranslation();
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ["datasets", id], queryFn: () => datasetsApi.get(id) });
  const [editing, setEditing] = useState(false);
  const { busy, run } = useSave();
  if (query.isPending) return <RouteLoading />;
  if (query.isError)
    return (
      <div className="p-6" role="alert">
        {query.error.message}
      </div>
    );
  const detail = query.data;
  return (
    <div className="flex h-full min-h-0 flex-col gap-6 p-4 lg:p-6">
      <Link
        to="/datasets"
        className="inline-flex shrink-0 items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("datasets.title")}
      </Link>
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{detail.dataset.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{detail.dataset.description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil />
            {t("datasets.edit")}
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => {
              if (window.confirm(t("datasets.deleteDatasetConfirm")))
                void run(
                  () => datasetsApi.remove(id),
                  () => {
                    void navigate({ to: "/datasets" });
                  },
                );
            }}
          >
            <Trash2 />
            {t("datasets.delete")}
          </Button>
        </div>
      </div>
      <Tabs className="min-h-0 flex-1" defaultValue={hash === "models" ? "schemas" : "records"}>
        <TabsList className="shrink-0">
          <TabsTrigger value="records">{t("datasets.records")}</TabsTrigger>
          <TabsTrigger value="schemas">{t("datasets.schemas")}</TabsTrigger>
          <TabsTrigger value="clients">{t("datasets.clients")}</TabsTrigger>
        </TabsList>
        <TabsContent value="records" className="min-h-0 flex-1">
          <RecordsPanel detail={detail} />
        </TabsContent>
        <TabsContent value="schemas" className="min-h-0 flex-1 overflow-y-auto p-1">
          <SchemasPanel detail={detail} />
        </TabsContent>
        <TabsContent value="clients" className="min-h-0 flex-1">
          <BindingsPanel key={detail.dataset.id} detail={detail} />
        </TabsContent>
      </Tabs>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("datasets.edit")}</DialogTitle>
            <DialogDescription>{t("datasets.descriptionText")}</DialogDescription>
          </DialogHeader>
          <DatasetForm dataset={detail.dataset} close={() => setEditing(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
function BindingsPanel({ detail }: { detail: DatasetDetail }) {
  const { t } = useTranslation();
  const clients = useQuery({ queryKey: ["clients"], queryFn: getClients });
  const [selected, setSelected] = useState(detail.clientIds);
  const [q, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const { busy, run } = useSave();
  if (clients.isPending) return <RouteLoading />;
  if (clients.isError) return <p role="alert">{clients.error.message}</p>;
  const filtered = clients.data.filter((client) =>
    [client.name, client.slug, client.platform].some((value) =>
      value.toLowerCase().includes(q.toLowerCase()),
    ),
  );
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 10) - 1));
  const visible = filtered.slice(currentPage * 10, (currentPage + 1) * 10);
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <p className="shrink-0 text-sm text-muted-foreground">{t("datasets.boundaryHint")}</p>
      <DatasetSearch
        placeholder={t("clientsSearchPlaceholder")}
        onSearch={(value) => {
          setQuery(value.trim());
          setPage(0);
        }}
      />
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-1">
        {visible.map((client) => (
          <label key={client.id} className="flex items-center gap-3 rounded-lg border p-3">
            <input
              type="checkbox"
              disabled={busy}
              checked={selected.includes(client.id)}
              onChange={(e) => {
                setSelected((previous) =>
                  e.target.checked
                    ? [...previous, client.id]
                    : previous.filter((id) => id !== client.id),
                );
              }}
            />
            <span className="min-w-0 break-words">
              {client.name}{" "}
              <span className="text-muted-foreground">
                {client.platform} / {client.slug}
              </span>
            </span>
          </label>
        ))}
        {!visible.length && (
          <p className="py-8 text-center text-muted-foreground">
            {t(q ? "datasets.noMatchingClients" : "datasets.noClients")}
          </p>
        )}
      </div>
      <div className="grid shrink-0 grid-cols-1 items-center gap-3 border-t bg-background pt-4 sm:grid-cols-[1fr_auto_1fr]">
        <div className="justify-self-center sm:col-start-2 sm:row-start-1">
          <DatasetPagination
            page={currentPage}
            hasMore={(currentPage + 1) * 10 < filtered.length}
            busy={busy}
            onPage={setPage}
          />
        </div>
        <Button
          className="justify-self-end sm:col-start-3 sm:row-start-1"
          disabled={busy}
          onClick={() => void run(() => datasetsApi.bind(detail.dataset.id, selected))}
        >
          {t("datasets.saveBindings")}
        </Button>
      </div>
    </div>
  );
}
function SchemasPanel({ detail }: { detail: DatasetDetail }) {
  const { t } = useTranslation();
  const [editor, setEditor] = useState<Category | null>(null);
  const [history, setHistory] = useState<Category | null>(null);
  const { busy, run } = useSave();
  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("datasets.versionHint")}</p>
        <Button asChild>
          <Link to="/datasets/$datasetId/models/new" params={{ datasetId: detail.dataset.id }}>
            <Plus />
            {t("datasets.createSchema")}
          </Link>
        </Button>
      </div>
      {detail.categories.map((category) => (
        <Card key={category.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>
                {category.name} <Badge variant="secondary">v{category.version}</Badge>{" "}
                {category.archivedAt !== null && (
                  <Badge variant="outline">{t("datasets.archived")}</Badge>
                )}
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setHistory(category)}>
                  {t("datasets.history")}
                </Button>
                {category.archivedAt === null && (
                  <>
                    <Button variant="outline" onClick={() => setEditor(category)}>
                      {t("datasets.edit")}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(t("datasets.archiveConfirm")))
                          void run(() =>
                            datasetsApi.archiveCategory(detail.dataset.id, category.id),
                          );
                      }}
                    >
                      {t("datasets.archive")}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ModelFieldsSummary schema={category.schema} />
          </CardContent>
        </Card>
      ))}
      {!detail.categories.length && (
        <p className="py-8 text-center text-muted-foreground">{t("datasets.noSchemas")}</p>
      )}
      <Dialog
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("datasets.schemas")}</DialogTitle>
            <DialogDescription>{t("datasets.versionHint")}</DialogDescription>
          </DialogHeader>
          {editor && (
            <ModelForm
              datasetId={detail.dataset.id}
              category={editor}
              close={() => setEditor(null)}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!history}
        onOpenChange={(open) => {
          if (!open) setHistory(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("datasets.history")}</DialogTitle>
            <DialogDescription>{history?.name}</DialogDescription>
          </DialogHeader>
          {history && <SchemaHistory datasetId={detail.dataset.id} categoryId={history.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function SchemaHistory({ datasetId, categoryId }: { datasetId: string; categoryId: string }) {
  const query = useQuery({
    queryKey: ["datasets", datasetId, "versions", categoryId],
    queryFn: () => datasetsApi.versions(datasetId, categoryId),
  });
  if (query.isPending) return <RouteLoading />;
  if (query.isError) return <p role="alert">{query.error.message}</p>;
  return (
    <div className="space-y-4">
      {query.data.map((row) => (
        <div key={row.version}>
          <Badge>v{row.version}</Badge>
          <ModelFieldsSummary schema={row.schema} />
        </div>
      ))}
    </div>
  );
}
function RecordsPanel({ detail }: { detail: DatasetDetail }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [q, setQuery] = useState("");
  const [previewSnapshot, setPreview] = useState<DatasetRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DatasetRecord | null>(null);
  const { busy, run } = useSave();
  const id = detail.dataset.id;
  const query = useQuery({
    queryKey: ["datasets", id, "records", page, q],
    queryFn: () => datasetsApi.records(id, page, q),
    refetchInterval: 10000,
    placeholderData: keepPreviousData,
  });
  const preview = previewSnapshot
    ? (query.data?.records.find((record) => record.id === previewSnapshot.id) ?? previewSnapshot)
    : null;
  if (query.isPending) return <RouteLoading />;
  if (query.isError) return <p role="alert">{query.error.message}</p>;
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("datasets.syncHint")}</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void run(() => datasetsApi.sync(id))}
          >
            <RefreshCw />
            {t("datasets.retry")}
          </Button>
          <Button asChild>
            <Link to="/datasets/$datasetId/records/new" params={{ datasetId: id }}>
              <Plus />
              {t("datasets.addRecord")}
            </Link>
          </Button>
        </div>
      </div>
      <DatasetSearch
        placeholder={t("datasets.recordSearchPlaceholder")}
        onSearch={(value) => {
          setQuery(value.trim());
          setPage(0);
        }}
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        <div className="divide-y rounded-lg border">
          {query.data.records.map((record) => (
            <div key={record.id} className="flex items-center gap-2 px-2">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 px-2 py-3 text-left text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={() => setPreview(record)}
              >
                <span className="min-w-0 break-words">
                  {typeof record.data.name === "string" && record.data.name.trim()
                    ? record.data.name
                    : record.title}
                </span>
                {record.categoryId &&
                  detail.categories.find((model) => model.id === record.categoryId) && (
                    <Badge variant="secondary" className="shrink-0">
                      {detail.categories.find((model) => model.id === record.categoryId)!.name}
                    </Badge>
                  )}
                <Badge
                  className="ml-auto shrink-0"
                  variant={record.syncStatus === "error" ? "destructive" : "secondary"}
                >
                  {record.enabled
                    ? t(`datasets.status.${record.syncStatus}`)
                    : t("datasets.recordDisabled")}
                </Badge>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                <Switch
                  checked={record.enabled}
                  disabled={busy}
                  aria-label={t("datasets.recordEnabled")}
                  title={t("datasets.recordEnabledHint")}
                  onCheckedChange={(enabled) =>
                    void run(() => datasetsApi.setRecordEnabled(id, record, enabled))
                  }
                />
                <Button asChild variant="ghost" size="icon" aria-label={t("datasets.edit")}>
                  <Link
                    to="/datasets/$datasetId/records/$recordId/edit"
                    params={{ datasetId: id, recordId: record.id }}
                  >
                    <Pencil className="size-4" />
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  aria-label={t("datasets.delete")}
                  onClick={() => setDeleteTarget(record)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        {!query.data.records.length && (
          <p className="py-8 text-center text-muted-foreground">{t("datasets.noRecords")}</p>
        )}
      </div>
      <div className="flex shrink-0 justify-center border-t bg-background pt-4">
        <DatasetPagination
          page={page}
          hasMore={query.data.hasMore}
          busy={query.isFetching}
          onPage={setPage}
        />
      </div>
      <Dialog
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-3xl">
          {preview && (
            <>
              <DialogHeader>
                <DialogTitle className="break-words pr-6">
                  {typeof preview.data.name === "string" && preview.data.name.trim()
                    ? preview.data.name
                    : preview.title}
                </DialogTitle>
                <DialogDescription>
                  {preview.categoryId
                    ? detail.categories.find((c) => c.id === preview.categoryId)?.name
                    : t("datasets.noModel")}
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-y-auto pr-2">
                <RecordFields record={preview} />
                {preview.syncError && (
                  <p className="mt-3 text-sm text-destructive">{preview.syncError}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center justify-end gap-2 border-t bg-background pt-4">
                <Badge variant={preview.syncStatus === "error" ? "destructive" : "secondary"}>
                  {preview.enabled
                    ? t(`datasets.status.${preview.syncStatus}`)
                    : t("datasets.recordDisabled")}
                </Badge>
                <Button variant="outline" asChild>
                  <Link
                    to="/datasets/$datasetId/records/$recordId/edit"
                    params={{ datasetId: id, recordId: preview.id }}
                  >
                    {t("datasets.edit")}
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  aria-label={t("datasets.delete")}
                  onClick={() => setDeleteTarget(preview)}
                >
                  <Trash2 />
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("datasets.confirmDelete")}</DialogTitle>
            <DialogDescription>{t("datasets.deleteRecordConfirm")}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              autoFocus
              disabled={busy}
              onClick={() => setDeleteTarget(null)}
            >
              {t("datasets.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => {
                if (deleteTarget)
                  void run(
                    () => datasetsApi.removeRecord(id, deleteTarget.id),
                    () => {
                      setDeleteTarget(null);
                      setPreview(null);
                    },
                  );
              }}
            >
              {t("datasets.confirmDelete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
