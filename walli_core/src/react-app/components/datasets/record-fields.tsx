import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "react-i18next";
import type { DataSchema, DatasetRecord } from "@shared/datasets";

function FieldValue({ value, schema }: { value: unknown; schema?: DataSchema }) {
  const { t } = useTranslation();
  if (schema?.format === "markdown" && typeof value === "string")
    return (
      <div className="min-w-0 space-y-3 break-words [&_h1]:text-xl [&_h2]:text-lg [&_h3]:font-semibold [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_a]:text-primary [&_a]:underline [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_table]:block [&_table]:overflow-x-auto [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:p-2">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
      </div>
    );
  if (Array.isArray(value))
    return (
      <ul className="list-disc space-y-1 pl-5">
        {value.map((item, index) => (
          <li key={index}>
            <FieldValue value={item} schema={schema?.items} />
          </li>
        ))}
      </ul>
    );
  if (value && typeof value === "object")
    return (
      <dl className="space-y-2">
        {Object.entries(value).map(([key, item]) => (
          <div key={key}>
            <dt className="text-muted-foreground">{key}</dt>
            <dd>
              <FieldValue value={item} schema={schema?.properties?.[key]} />
            </dd>
          </div>
        ))}
      </dl>
    );
  return (
    <span className="whitespace-pre-wrap break-words">
      {typeof value === "boolean"
        ? t(value ? "datasets.trueValue" : "datasets.falseValue")
        : String(value ?? "—")}
    </span>
  );
}

export function RecordFields({ record }: { record: DatasetRecord }) {
  const { t } = useTranslation();
  return (
    <dl className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(record.data).map(([name, value]) => {
        const schema = record.schema.properties?.[name];
        return (
          <div
            key={name}
            className={`min-w-0 ${schema?.format === "markdown" || typeof value === "object" ? "col-span-full" : ""}`}
          >
            <dt className="mb-1 flex items-baseline gap-2 text-sm font-medium">
              {record.categoryId ? name : t("datasets.content")}
              {schema?.description && (
                <span
                  className="truncate text-xs font-normal text-muted-foreground"
                  title={schema.description}
                >
                  {schema.description}
                </span>
              )}
            </dt>
            <dd className="min-w-0 text-sm">
              <FieldValue value={value} schema={schema} />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
