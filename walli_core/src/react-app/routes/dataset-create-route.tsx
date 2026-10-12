import { useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { datasetsApi } from "@/datasets-api";
import { ModelForm, RecordForm } from "@/components/datasets/model-forms";
import { Card, CardContent } from "@/components/ui/card";
import { RouteLoading } from "./route-loading";

function DatasetCreatePage({ kind }: { kind: "model" | "record" }) {
  const [footer, setFooter] = useState<HTMLDivElement | null>(null);
  const { datasetId, recordId } = useParams({ strict: false });
  const { t } = useTranslation();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["datasets", datasetId],
    queryFn: () => datasetsApi.get(datasetId!),
    enabled: !!datasetId,
  });
  const recordQuery = useQuery({
    queryKey: ["datasets", datasetId, "record", recordId],
    queryFn: () => datasetsApi.record(datasetId!, recordId!),
    enabled: !!datasetId && !!recordId,
  });
  if (recordId && recordQuery.isPending) return <RouteLoading />;
  if (recordId && recordQuery.isError)
    return (
      <p role="alert" className="p-6">
        {recordQuery.error.message}
      </p>
    );
  if (query.isPending) return <RouteLoading />;
  if (query.isError)
    return (
      <p role="alert" className="p-6">
        {query.error.message}
      </p>
    );
  const back = () => {
    void navigate({
      to: "/datasets/$datasetId",
      params: { datasetId: datasetId! },
      hash: kind === "model" ? "models" : "",
    });
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 bg-background px-4 py-5 lg:px-6">
          <Link
            to="/datasets/$datasetId"
            params={{ datasetId: datasetId! }}
            hash={kind === "model" ? "models" : ""}
            className="inline-flex shrink-0 items-center gap-2 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-4" />
            {t("datasets.title")}
          </Link>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl space-y-6 p-4 lg:p-6">
          <header className="shrink-0">
            <h1 className="text-2xl font-semibold">
              {t(
                kind === "model"
                  ? "datasets.createSchema"
                  : recordId
                    ? "datasets.edit"
                    : "datasets.addRecord",
              )}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(kind === "model" ? "datasets.versionHint" : "datasets.recordVersionHint")}
            </p>
          </header>
          <Card>
            <CardContent>
              {kind === "model" ? (
                <ModelForm key={datasetId} datasetId={datasetId!} close={back} />
              ) : (
                <RecordForm
                  key={recordId ?? datasetId}
                  detail={query.data}
                  record={recordId ? recordQuery.data : undefined}
                  close={back}
                  footer={footer}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      {kind === "record" && (
        <footer className="shrink-0 border-t bg-background px-4 py-4 lg:px-6">
          <div ref={setFooter} className="mx-auto flex w-full max-w-5xl items-center justify-end" />
        </footer>
      )}
    </div>
  );
}
export function NewDatasetModelRoute() {
  return <DatasetCreatePage kind="model" />;
}
export function NewDatasetRecordRoute() {
  return <DatasetCreatePage kind="record" />;
}

export function EditDatasetRecordRoute() {
  return <DatasetCreatePage kind="record" />;
}
