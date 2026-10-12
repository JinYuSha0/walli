import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import {
  dataSchema,
  markdownRecordSchema,
  validateData,
  type Category,
  type DataSchema,
  type DatasetDetail,
  type DatasetRecord,
} from "@shared/datasets";
import { datasetsApi } from "@/datasets-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { TextEditor } from "@/components/ui/text_editor";
import { MarkdownEditor } from "./markdown-editor";
import { useSave } from "./use-save";

type FieldKind = "string" | "number" | "boolean" | "date-time" | "markdown" | "legacy";
const kinds: FieldKind[] = ["string", "number", "boolean", "date-time", "markdown"];
const kindOf = (schema: DataSchema): FieldKind =>
  schema.format ??
  (schema.type === "integer"
    ? "number"
    : kinds.includes(schema.type as FieldKind)
      ? (schema.type as FieldKind)
      : "legacy");
type FieldDraft = {
  name: string;
  type: FieldKind;
  description: string;
  required: boolean;
  min: string;
  max: string;
  original?: DataSchema;
};
type ModelDraft = { name: string; fields: FieldDraft[] };
const fieldDraft = (name = "", schema?: DataSchema, required = false): FieldDraft => ({
  name,
  type: schema ? kindOf(schema) : "string",
  description: schema?.description ?? "",
  required,
  min: String(schema?.minimum ?? schema?.minLength ?? ""),
  max: String(schema?.maximum ?? schema?.maxLength ?? ""),
  original: schema,
});

export function ModelFieldsSummary({ schema }: { schema: DataSchema }) {
  const { t } = useTranslation();
  return (
    <div className="divide-y rounded-md border">
      {Object.entries(schema.properties ?? {}).map(([name, field]) => (
        <div key={name} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
          <span className="font-medium">{name}</span>
          <span className="text-muted-foreground">{t(`datasets.fieldTypes.${kindOf(field)}`)}</span>
          {schema.required?.includes(name) && (
            <span className="text-xs text-muted-foreground">{t("datasets.required")}</span>
          )}
          {field.description && <span className="text-muted-foreground">{field.description}</span>}
        </div>
      ))}
      {!Object.keys(schema.properties ?? {}).length && (
        <p className="p-3 text-sm text-muted-foreground">{t("datasets.noFields")}</p>
      )}
    </div>
  );
}

export function ModelForm({
  datasetId,
  category,
  close,
}: {
  datasetId: string;
  category?: Category;
  close: () => void;
}) {
  const { t } = useTranslation();
  const { busy, run } = useSave();
  const form = useForm<ModelDraft>({
    defaultValues: {
      name: category?.name ?? "",
      fields: Object.entries(category?.schema.properties ?? {}).map(([name, schema]) =>
        fieldDraft(name, schema, category?.schema.required?.includes(name)),
      ),
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "fields" });
  const values = useWatch({ control: form.control, name: "fields" });
  const errorText = t("datasets.invalidField");
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={form.handleSubmit((draft) => {
        const properties: Record<string, DataSchema> = {};
        for (const field of draft.fields) {
          const same = field.original && kindOf(field.original) === field.type;
          const schema: DataSchema = same
            ? { ...field.original! }
            : {
                type:
                  field.type === "number"
                    ? "number"
                    : field.type === "boolean"
                      ? "boolean"
                      : "string",
              };
          schema.description = field.description;
          if (field.type === "date-time" || field.type === "markdown") schema.format = field.type;
          if (["string", "markdown", "number"].includes(field.type)) {
            delete schema.minimum;
            delete schema.maximum;
            delete schema.minLength;
            delete schema.maxLength;
            if (field.min !== "")
              schema[field.type === "number" ? "minimum" : "minLength"] = Number(field.min);
            if (field.max !== "")
              schema[field.type === "number" ? "maximum" : "maxLength"] = Number(field.max);
            if (field.required && schema.type === "string")
              schema.minLength = Math.max(1, schema.minLength ?? 0);
          }
          properties[field.name] = schema;
        }
        const result = dataSchema.safeParse({
          type: "object",
          properties,
          required: draft.fields.filter((f) => f.required).map((f) => f.name),
          additionalProperties: false,
        });
        if (!result.success) {
          form.setError("root", { message: t("datasets.invalidBounds") });
          return;
        }
        void run(
          () =>
            datasetsApi.saveCategory(
              datasetId,
              { name: draft.name, schema: result.data },
              category,
            ),
          close,
        );
      })}
    >
      <div className="space-y-2">
        <Label htmlFor="model-name">{t("datasets.categoryName")}</Label>
        <Input
          id="model-name"
          {...form.register("name", {
            required: errorText,
            maxLength: { value: 100, message: errorText },
            validate: (v) => !!v.trim() || errorText,
          })}
        />
        {form.formState.errors.name && (
          <p role="alert" className="text-sm text-destructive">
            {errorText}
          </p>
        )}
      </div>
      {fields.map((field, index) => (
        <fieldset key={field.id} className="min-w-0 space-y-2 rounded-lg border p-3">
          <legend className="sr-only">{t("datasets.fieldNumber", { number: index + 1 })}</legend>
          <div className="overflow-x-auto">
            <div className="flex min-w-[760px] items-center gap-2 p-1">
              <div className="flex shrink-0 items-center gap-2">
                <div className="w-32">
                  <Label className="sr-only" htmlFor={`field-name-${index}`}>
                    {t("datasets.fieldName")}
                  </Label>
                  <Input
                    id={`field-name-${index}`}
                    placeholder={t("datasets.fieldName")}
                    {...form.register(`fields.${index}.name`, {
                      required: errorText,
                      pattern: { value: /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/, message: errorText },
                      validate: (value) =>
                        (!["constructor", "prototype", "__proto__"].includes(value) &&
                          form.getValues("fields").filter((f) => f.name === value).length === 1) ||
                        errorText,
                    })}
                  />
                </div>
                <div className="w-32">
                  <Label className="sr-only" htmlFor={`field-type-${index}`}>
                    {t("datasets.fieldType")}
                  </Label>
                  <Select id={`field-type-${index}`} {...form.register(`fields.${index}.type`)}>
                    {kinds.map((kind) => (
                      <option key={kind} value={kind}>
                        {t(`datasets.fieldTypes.${kind}`)}
                      </option>
                    ))}
                    {values[index]?.type === "legacy" && (
                      <option value="legacy">{t("datasets.fieldTypes.legacy")}</option>
                    )}
                  </Select>
                </div>
              </div>
              <Input
                className="min-w-32 flex-1"
                aria-label={t("datasets.fieldDescription")}
                placeholder={t("datasets.fieldDescription")}
                {...form.register(`fields.${index}.description`, { maxLength: 500 })}
              />
              <label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm">
                <input type="checkbox" {...form.register(`fields.${index}.required`)} />
                {t("datasets.required")}
              </label>
              {["string", "markdown", "number"].includes(values[index]?.type ?? "") && (
                <div className="flex shrink-0 items-center gap-2">
                  {(["min", "max"] as const).map((bound) => (
                    <div key={bound} className="w-24">
                      <Label className="sr-only" htmlFor={`field-${bound}-${index}`}>
                        {t(
                          `datasets.${values[index]?.type === "number" ? bound : `${bound}Length`}`,
                        )}
                      </Label>
                      <Input
                        id={`field-${bound}-${index}`}
                        placeholder={t(
                          `datasets.${values[index]?.type === "number" ? bound : `${bound}Length`}`,
                        )}
                        type="number"
                        step={values[index]?.type === "number" ? "any" : 1}
                        {...form.register(`fields.${index}.${bound}`, {
                          validate: (v) =>
                            v === "" ||
                            (Number.isFinite(Number(v)) &&
                              (values[index]?.type === "number" ||
                                (Number.isInteger(Number(v)) &&
                                  Number(v) >= 0 &&
                                  Number(v) <= 16000))) ||
                            errorText,
                        })}
                      />
                    </div>
                  ))}
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label={t("datasets.removeField")}
                onClick={() => remove(index)}
              >
                <Trash2 />
              </Button>
            </div>
          </div>
          {field.original?.enum && (
            <p className="text-xs text-muted-foreground">
              {t("datasets.allowedValues")}: {field.original.enum.join(", ")}
            </p>
          )}
          {form.formState.errors.fields?.[index] && (
            <p role="alert" className="text-sm text-destructive">
              {errorText}
            </p>
          )}
        </fieldset>
      ))}
      <p className="text-xs text-muted-foreground">{t("datasets.fieldNameHint")}</p>
      <Button
        type="button"
        variant="outline"
        disabled={fields.length >= 50}
        onClick={() => append(fieldDraft())}
      >
        <Plus />
        {t("datasets.addField")}
      </Button>
      {form.formState.errors.root && (
        <p role="alert" className="text-sm text-destructive">
          {form.formState.errors.root.message}
        </p>
      )}
      <div>
        <Button disabled={busy}>{t("datasets.publish")}</Button>
      </div>
    </form>
  );
}

const localDate = (value: unknown) => {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, -1);
};

export function RecordForm({
  detail,
  record,
  close,
  footer,
}: {
  detail: DatasetDetail;
  record?: DatasetRecord;
  close: () => void;
  footer?: HTMLDivElement | null;
}) {
  const { t } = useTranslation();
  const formId = useId();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [modelId, setModelId] = useState(record?.categoryId ?? "");
  const model = detail.categories.find((c) => c.id === modelId);
  const schema = model?.schema ?? markdownRecordSchema;
  const { busy, run } = useSave();
  const form = useForm<{ title: string; values: Record<string, unknown> }>({
    defaultValues: { title: record?.title ?? "", values: record?.data ?? {} },
  });
  const watchedValues = useWatch({ control: form.control, name: "values" });
  const extras = Object.keys(watchedValues).filter(
    (key) => !Object.hasOwn(schema.properties ?? {}, key),
  );
  const fieldError = t("datasets.invalidValue");
  const saveButton = (
    <div className="flex items-center justify-end gap-2">
      {record && (
        <Button
          type="button"
          variant="destructive"
          disabled={busy}
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 />
          {t("datasets.delete")}
        </Button>
      )}
      <Button
        type="submit"
        form={formId}
        disabled={busy || !!(modelId && (!model || model.archivedAt !== null))}
      >
        {t("datasets.save")}
      </Button>
    </div>
  );
  return (
    <form
      id={formId}
      className="space-y-4"
      noValidate
      onSubmit={form.handleSubmit(({ title, values }) => {
        const data = Object.fromEntries(
          Object.entries(values).filter(([, value]) => value !== undefined),
        );
        if (validateData(schema, data).length || JSON.stringify(data).length > 16000) {
          form.setError("root", { message: t("datasets.recordInvalid") });
          return;
        }
        void run(
          () =>
            datasetsApi.saveRecord(
              detail.dataset.id,
              { categoryId: modelId || null, schemaVersion: model?.version ?? 1, title, data },
              record,
            ),
          close,
        );
      })}
    >
      <div className="space-y-4 p-1">
        <div className="space-y-2">
          <Label htmlFor="record-model">{t("datasets.categoryName")}</Label>
          <Select
            id="record-model"
            value={modelId}
            onChange={(event) => {
              if (
                Object.values(form.getValues("values")).some(
                  (value) => value !== undefined && value !== "",
                ) &&
                !window.confirm(t("datasets.switchModelConfirm"))
              )
                return;
              setModelId(event.target.value);
              form.reset({ title: form.getValues("title"), values: {} });
            }}
          >
            <option value="">{t("datasets.noModel")}</option>
            {detail.categories.map((c) => (
              <option key={c.id} value={c.id} disabled={c.archivedAt !== null}>
                {c.name} · v{c.version}
                {c.archivedAt !== null ? ` (${t("datasets.archived")})` : ""}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="record-title">{t("datasets.recordTitle")}</Label>
          <Input
            id="record-title"
            {...form.register("title", {
              required: fieldError,
              maxLength: { value: 200, message: fieldError },
              validate: (v) => !!v.trim() || fieldError,
            })}
          />
          {form.formState.errors.title && (
            <p role="alert" className="text-sm text-destructive">
              {fieldError}
            </p>
          )}
        </div>
        {Object.entries(schema.properties ?? {}).map(([name, fieldSchema]) => {
          const required = schema.required?.includes(name);
          const id = `record-field-${name}`;
          return (
            <Controller
              key={`${modelId}:${name}`}
              control={form.control}
              name={`values.${name}`}
              rules={{
                validate: (value) =>
                  value === undefined
                    ? !required || fieldError
                    : !validateData(fieldSchema, value).length || fieldError,
              }}
              render={({ field, fieldState }) => {
                const update = (value: unknown) =>
                  field.onChange(value === "" && !required ? undefined : value);
                return (
                  <div className="space-y-2">
                    <div className="flex min-w-0 items-baseline gap-2">
                      <Label id={`${id}-label`} htmlFor={id} className="shrink-0">
                        {modelId ? name : t("datasets.content")}
                        {required ? " *" : ""}
                      </Label>
                      {fieldSchema.description && (
                        <span
                          className="truncate text-xs text-muted-foreground"
                          title={fieldSchema.description}
                        >
                          {fieldSchema.description}
                        </span>
                      )}
                    </div>
                    {fieldSchema.enum ? (
                      <Select
                        id={id}
                        value={
                          field.value === undefined
                            ? ""
                            : String(
                                fieldSchema.enum.indexOf(field.value as string | number | boolean),
                              )
                        }
                        onBlur={field.onBlur}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ""
                              ? undefined
                              : fieldSchema.enum![Number(e.target.value)],
                          )
                        }
                      >
                        <option value="">{t("datasets.chooseValue")}</option>
                        {fieldSchema.enum.map((value, index) => (
                          <option key={index} value={index}>
                            {String(value)}
                          </option>
                        ))}
                      </Select>
                    ) : fieldSchema.format === "markdown" ? (
                      <MarkdownEditor
                        id={id}
                        value={typeof field.value === "string" ? field.value : ""}
                        onChange={update}
                        onBlur={field.onBlur}
                        invalid={fieldState.invalid}
                      />
                    ) : fieldSchema.type === "boolean" ? (
                      <Select
                        id={id}
                        value={field.value === undefined ? "" : String(field.value)}
                        onBlur={field.onBlur}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? undefined : e.target.value === "true",
                          )
                        }
                      >
                        <option value="">{t("datasets.chooseValue")}</option>
                        <option value="true">{t("datasets.trueValue")}</option>
                        <option value="false">{t("datasets.falseValue")}</option>
                      </Select>
                    ) : fieldSchema.format === "date-time" ? (
                      <Input
                        id={id}
                        type="datetime-local"
                        step="0.001"
                        defaultValue={localDate(field.value)}
                        onBlur={(e) => {
                          const value = e.currentTarget.value;
                          const date = new Date(value);
                          update(
                            value && !Number.isNaN(date.getTime()) ? date.toISOString() : value,
                          );
                          field.onBlur();
                        }}
                        onChange={(e) => {
                          const value = e.target.value;
                          const date = new Date(value);
                          update(
                            value && !Number.isNaN(date.getTime()) ? date.toISOString() : value,
                          );
                        }}
                      />
                    ) : fieldSchema.type === "number" || fieldSchema.type === "integer" ? (
                      <Input
                        id={id}
                        type="number"
                        step={fieldSchema.type === "integer" ? 1 : "any"}
                        min={fieldSchema.minimum}
                        max={fieldSchema.maximum}
                        value={typeof field.value === "number" ? field.value : ""}
                        onBlur={field.onBlur}
                        onChange={(e) =>
                          update(e.target.value === "" ? "" : e.target.valueAsNumber)
                        }
                      />
                    ) : fieldSchema.type === "string" ? (
                      <Input
                        id={id}
                        value={typeof field.value === "string" ? field.value : ""}
                        onBlur={field.onBlur}
                        onChange={(e) => update(e.target.value)}
                      />
                    ) : (
                      <TextEditor
                        id={id}
                        value={
                          typeof field.value === "string"
                            ? field.value
                            : JSON.stringify(
                                field.value ?? (fieldSchema.type === "array" ? [] : {}),
                                null,
                                2,
                              )
                        }
                        onChange={(value) => {
                          try {
                            field.onChange(JSON.parse(value));
                          } catch {
                            field.onChange(value);
                          }
                        }}
                      />
                    )}
                    {(fieldSchema.minimum !== undefined || fieldSchema.maximum !== undefined) && (
                      <p className="text-xs text-muted-foreground">
                        {t("datasets.rangeHint", {
                          min: fieldSchema.minimum ?? "—",
                          max: fieldSchema.maximum ?? "—",
                        })}
                      </p>
                    )}
                    {fieldState.error && (
                      <p role="alert" className="text-sm text-destructive">
                        {fieldState.error.message}
                      </p>
                    )}
                  </div>
                );
              }}
            />
          );
        })}
        {!!extras.length && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm">
              {t("datasets.obsoleteFields")}: {extras.join(", ")}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (window.confirm(t("datasets.removeObsoleteConfirm")))
                  for (const key of extras) form.unregister(`values.${key}`);
              }}
            >
              {t("datasets.removeObsolete")}
            </Button>
          </div>
        )}
        {form.formState.errors.root && (
          <p role="alert" className="text-sm text-destructive">
            {form.formState.errors.root.message}
          </p>
        )}
      </div>
      {footer ? createPortal(saveButton, footer) : saveButton}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!busy) setDeleteOpen(open);
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
              onClick={() => setDeleteOpen(false)}
            >
              {t("datasets.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => {
                if (record)
                  void run(
                    () => datasetsApi.removeRecord(detail.dataset.id, record.id),
                    () => {
                      setDeleteOpen(false);
                      close();
                    },
                  );
              }}
            >
              {t("datasets.confirmDelete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}
