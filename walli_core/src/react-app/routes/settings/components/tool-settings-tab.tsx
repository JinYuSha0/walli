import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { updateSettings } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  TOOL_API_METHODS,
  TOOL_INVOCATION_TYPES,
  TOOL_SCHEMA_FIELD_TYPES,
  type ModelConfig,
  type ToolConfig,
  type ToolSchemaField,
} from "../../../../shared/const";

type ToolSettingsForm = {
  tools: Array<{
    formId?: string;
    name: string;
    description: string;
    invocation: {
      type: "model" | "api";
      model: string;
      url: string;
      method: "GET" | "POST";
    };
    schema: ToolConfig["schema"];
  }>;
};

type ToolSettingsTabProps = {
  models: ModelConfig[];
  tools: ToolConfig[];
};

const createEmptySchemaField = (): ToolSchemaField => ({
  name: "",
  type: "string",
  description: "",
  required: false,
  defaultValue: "",
});

const createRequiredSchemaField = (): ToolSchemaField => ({
  ...createEmptySchemaField(),
  required: true,
});

const createEmptyTool = () => ({
  name: "",
  description: "",
  invocation: {
    type: "model" as const,
    model: "",
    url: "",
    method: "POST" as const,
  },
  schema: {
    fields: [createRequiredSchemaField()],
  },
});

const createToolFormId = () =>
  globalThis.crypto?.randomUUID?.() ?? `tool-${Date.now()}`;

const isValidHttpUrl = (value: string) => {
  try {
    const url = new URL(value.trim());

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export function ToolSettingsTab({ models, tools }: ToolSettingsTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editingToolId, setEditingToolId] = useState<string | null>(null);
  const form = useForm<ToolSettingsForm>({
    defaultValues: {
      tools: tools.map((tool) => ({
        ...tool,
        invocation: {
          type: tool.invocation.type,
          model: tool.invocation.type === "model" ? tool.invocation.model : "",
          url: tool.invocation.type === "api" ? tool.invocation.url : "",
          method: tool.invocation.type === "api" ? tool.invocation.method : "POST",
        },
      })),
    },
  });
  const { fields, append, move, remove } = useFieldArray({
    control: form.control,
    name: "tools",
  });
  const updateSettingsMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (values) => {
      queryClient.setQueryData(["settings"], values);
      form.reset({
        tools: values.tools.map((tool) => ({
          ...tool,
          invocation: {
            type: tool.invocation.type,
            model: tool.invocation.type === "model" ? tool.invocation.model : "",
            url: tool.invocation.type === "api" ? tool.invocation.url : "",
            method: tool.invocation.type === "api" ? tool.invocation.method : "POST",
          },
        })),
      });
      setEditingToolId(null);
      toast.success(t("toolSettingsSaveSuccess"));
    },
  });

  useEffect(() => {
    form.reset({
      tools: tools.map((tool) => ({
        ...tool,
        invocation: {
          type: tool.invocation.type,
          model: tool.invocation.type === "model" ? tool.invocation.model : "",
          url: tool.invocation.type === "api" ? tool.invocation.url : "",
          method: tool.invocation.type === "api" ? tool.invocation.method : "POST",
        },
      })),
    });
  }, [form, tools]);

  const addSchemaField = (toolIndex: number) => {
    const fieldsPath = `tools.${toolIndex}.schema.fields` as const;
    form.setValue(fieldsPath, [
      ...form.getValues(fieldsPath),
      createEmptySchemaField(),
    ]);
  };

  const removeSchemaField = (toolIndex: number, fieldIndex: number) => {
    const fieldsPath = `tools.${toolIndex}.schema.fields` as const;
    const fields = form.getValues(fieldsPath);
    const field = fields[fieldIndex];
    const requiredFieldCount = fields.filter((schemaField) => schemaField.required)
      .length;

    if (fields.length <= 1 || (field?.required && requiredFieldCount <= 1)) {
      return;
    }

    form.setValue(
      fieldsPath,
      fields.filter((_, index) => index !== fieldIndex),
    );
  };

  const onSubmit = (values: ToolSettingsForm) => {
    form.clearErrors();

    let firstInvalidToolId: string | null = null;
    values.tools.forEach((tool, toolIndex) => {
      const toolFormId = tool.formId ?? fields[toolIndex]?.id ?? null;
      const markInvalidTool = () => {
        firstInvalidToolId = firstInvalidToolId ?? toolFormId;
      };

      if (tool.name.trim().length === 0) {
        form.setError(`tools.${toolIndex}.name`, {
          message: t("toolSettingsToolNameRequired"),
        });
        markInvalidTool();
      }

      if (tool.description.trim().length === 0) {
        form.setError(`tools.${toolIndex}.description`, {
          message: t("toolSettingsToolDescriptionRequired"),
        });
        markInvalidTool();
      }

      if (
        tool.invocation.type === "model" &&
        tool.invocation.model.trim().length === 0
      ) {
        form.setError(`tools.${toolIndex}.invocation.model`, {
          message: t("toolSettingsInvocationModelRequired"),
        });
        markInvalidTool();
      }

      if (
        tool.invocation.type === "api" &&
        tool.invocation.url.trim().length === 0
      ) {
        form.setError(`tools.${toolIndex}.invocation.url`, {
          message: t("toolSettingsInvocationUrlRequired"),
        });
        markInvalidTool();
      }

      if (
        tool.invocation.type === "api" &&
        tool.invocation.url.trim().length > 0 &&
        !isValidHttpUrl(tool.invocation.url)
      ) {
        form.setError(`tools.${toolIndex}.invocation.url`, {
          message: t("toolSettingsInvocationUrlInvalid"),
        });
        markInvalidTool();
      }

      const namedSchemaFields = tool.schema.fields.filter(
        (field) => field.name.trim().length > 0,
      );

      if (namedSchemaFields.length === 0) {
        form.setError(`tools.${toolIndex}.schema.fields.0.name`, {
          message: t("toolSettingsSchemaFieldNameRequired"),
        });
        markInvalidTool();
      }

      tool.schema.fields.forEach((schemaField, schemaFieldIndex) => {
        if (schemaField.name.trim().length === 0) {
          form.setError(
            `tools.${toolIndex}.schema.fields.${schemaFieldIndex}.name`,
            {
              message: t("toolSettingsSchemaFieldNameRequired"),
            },
          );
          markInvalidTool();
        }

        if (schemaField.description.trim().length === 0) {
          form.setError(
            `tools.${toolIndex}.schema.fields.${schemaFieldIndex}.description`,
            {
              message: t("toolSettingsSchemaFieldDescriptionRequired"),
            },
          );
          markInvalidTool();
        }
      });

      if (!namedSchemaFields.some((field) => field.required)) {
        form.setError(`tools.${toolIndex}.schema.fields.0.name`, {
          message: t("toolSettingsSchemaRequiredFieldRequired"),
        });
        markInvalidTool();
      }
    });

    if (firstInvalidToolId) {
      setEditingToolId(firstInvalidToolId);
      return;
    }

    updateSettingsMutation.mutate({
      tools: values.tools
        .map((tool) => {
          const schemaFields = tool.schema.fields
            .map((field) => ({
              name: field.name.trim(),
              type: field.type,
              description: field.description.trim(),
              required: field.required,
              defaultValue: field.defaultValue.trim(),
            }))
            .filter((field) => field.name.length > 0);
          const normalizedSchemaFields =
            schemaFields.length === 0
              ? [createRequiredSchemaField()]
              : schemaFields.some((field) => field.required)
                ? schemaFields
                : [
                    {
                      ...schemaFields[0],
                      required: true,
                    },
                    ...schemaFields.slice(1),
                  ];

          return {
            name: tool.name.trim(),
            description: tool.description.trim(),
            invocation:
              tool.invocation.type === "model"
                ? {
                    type: "model" as const,
                    model: tool.invocation.model.trim(),
                  }
                : {
                    type: "api" as const,
                    url: tool.invocation.url.trim(),
                    method: tool.invocation.method,
                  },
            schema: {
              fields: normalizedSchemaFields,
            },
          };
        })
    });
  };

  return (
    <form className="grid gap-8" onSubmit={form.handleSubmit(onSubmit)}>
      <section className="grid gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-1">
            <h2 className="text-sm font-medium">{t("toolSettingsTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("toolSettingsDescription")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const formId = createToolFormId();

              append({
                ...createEmptyTool(),
                formId,
              });
              setEditingToolId(formId);
            }}
            disabled={updateSettingsMutation.isPending}
          >
            <Plus />
            {t("toolSettingsAddTool")}
          </Button>
        </div>

        <div className="grid gap-4">
          {fields.map((field, index) => {
            const schemaFields = form.watch(`tools.${index}.schema.fields`);
            const invocationType = form.watch(`tools.${index}.invocation.type`);
            const toolName = form.watch(`tools.${index}.name`);
            const toolDescription = form.watch(`tools.${index}.description`);
            const toolFormId = field.formId ?? field.id;
            const isEditing = editingToolId === toolFormId;

            return (
              <div
                key={field.id}
                className="grid gap-4 rounded-lg border border-border p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="grid min-w-0 flex-1 gap-1">
                    <h3 className="truncate text-sm font-medium">
                      {toolName || t("toolSettingsUntitledTool")}
                    </h3>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {toolDescription || t("toolSettingsNoDescription")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("toolSettingsSchemaFieldCount", {
                        count: schemaFields.length,
                      })}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant={isEditing ? "secondary" : "ghost"}
                      size="icon"
                      aria-label={t("toolSettingsEditTool")}
                      onClick={() => setEditingToolId(isEditing ? null : toolFormId)}
                      disabled={updateSettingsMutation.isPending}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("toolSettingsMoveUp")}
                      onClick={() => move(index, index - 1)}
                      disabled={updateSettingsMutation.isPending || index === 0}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("toolSettingsMoveDown")}
                      onClick={() => move(index, index + 1)}
                      disabled={
                        updateSettingsMutation.isPending ||
                        index === fields.length - 1
                      }
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("toolSettingsRemoveTool")}
                      onClick={() => {
                        remove(index);
                        if (isEditing) {
                          setEditingToolId(null);
                        }
                      }}
                      disabled={updateSettingsMutation.isPending}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>

                {isEditing && (
                  <div className="grid gap-5 border-t border-border pt-4">
                <div className="grid gap-4">
                  <div className="grid flex-1 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor={`tool-name-${field.id}`}>
                        {t("toolSettingsToolName")}
                      </Label>
                      <Controller
                        control={form.control}
                        name={`tools.${index}.name`}
                        rules={{ required: t("toolSettingsToolNameRequired") }}
                        render={({ field: nameField, fieldState }) => (
                          <div className="grid gap-2">
                            <Input
                              id={`tool-name-${field.id}`}
                              aria-invalid={fieldState.invalid}
                              disabled={updateSettingsMutation.isPending}
                              placeholder={t("toolSettingsToolNamePlaceholder")}
                              {...nameField}
                            />
                            {fieldState.error?.message && (
                              <p className="text-sm text-destructive">
                                {fieldState.error.message}
                              </p>
                            )}
                          </div>
                        )}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor={`tool-description-${field.id}`}>
                        {t("toolSettingsToolDescription")}
                      </Label>
                      <Controller
                        control={form.control}
                        name={`tools.${index}.description`}
                        rules={{
                          required: t("toolSettingsToolDescriptionRequired"),
                        }}
                        render={({ field: descriptionField, fieldState }) => (
                          <div className="grid gap-2">
                            <textarea
                              id={`tool-description-${field.id}`}
                              className="min-h-20 w-full rounded-lg border border-input bg-input/30 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
                              aria-invalid={fieldState.invalid}
                              disabled={updateSettingsMutation.isPending}
                              placeholder={t(
                                "toolSettingsToolDescriptionPlaceholder",
                              )}
                              {...descriptionField}
                            />
                            {fieldState.error?.message && (
                              <p className="text-sm text-destructive">
                                {fieldState.error.message}
                              </p>
                            )}
                          </div>
                        )}
                      />
                    </div>
                  </div>

                </div>

                <div className="grid gap-3 border-t border-border pt-4">
                  <div className="grid gap-1">
                    <h3 className="text-sm font-medium">
                      {t("toolSettingsInvocationTitle")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t("toolSettingsInvocationDescription")}
                    </p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[12rem_minmax(0,1fr)]">
                    <div className="grid gap-2">
                      <Label>{t("toolSettingsInvocationType")}</Label>
                      <Controller
                        control={form.control}
                        name={`tools.${index}.invocation.type`}
                        render={({ field: invocationTypeField }) => (
                          <Select
                            disabled={updateSettingsMutation.isPending}
                            {...invocationTypeField}
                          >
                            {TOOL_INVOCATION_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {t(`toolInvocationType.${type}`)}
                              </option>
                            ))}
                          </Select>
                        )}
                      />
                    </div>

                    {invocationType === "model" ? (
                      <div className="grid gap-2">
                        <Label>{t("toolSettingsInvocationModel")}</Label>
                        <Controller
                          control={form.control}
                          name={`tools.${index}.invocation.model`}
                          rules={{
                            required: t("toolSettingsInvocationModelRequired"),
                          }}
                          render={({ field: invocationModelField, fieldState }) => (
                            <div className="grid gap-2">
                              <Select
                                aria-invalid={fieldState.invalid}
                                disabled={updateSettingsMutation.isPending}
                                {...invocationModelField}
                              >
                                <option value="">
                                  {t("toolSettingsInvocationSelectModel")}
                                </option>
                                {models.map((model) => (
                                  <option key={model.name} value={model.name}>
                                    {model.name}
                                  </option>
                                ))}
                              </Select>
                              {fieldState.error?.message && (
                                <p className="text-sm text-destructive">
                                  {fieldState.error.message}
                                </p>
                              )}
                            </div>
                          )}
                        />
                      </div>
                    ) : (
                      <div className="grid gap-4 lg:grid-cols-[8rem_minmax(0,1fr)]">
                        <div className="grid gap-2">
                          <Label>{t("toolSettingsInvocationMethod")}</Label>
                          <Controller
                            control={form.control}
                            name={`tools.${index}.invocation.method`}
                            render={({ field: invocationMethodField }) => (
                              <Select
                                disabled={updateSettingsMutation.isPending}
                                {...invocationMethodField}
                              >
                                {TOOL_API_METHODS.map((method) => (
                                  <option key={method} value={method}>
                                    {method}
                                  </option>
                                ))}
                              </Select>
                            )}
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label>{t("toolSettingsInvocationUrl")}</Label>
                          <Controller
                            control={form.control}
                            name={`tools.${index}.invocation.url`}
                            rules={{
                              validate: (value) => {
                                const trimmedValue = value.trim();

                                if (trimmedValue.length === 0) {
                                  return t("toolSettingsInvocationUrlRequired");
                                }

                                return (
                                  isValidHttpUrl(trimmedValue) ||
                                  t("toolSettingsInvocationUrlInvalid")
                                );
                              },
                            }}
                            render={({ field: invocationUrlField, fieldState }) => (
                              <div className="grid gap-2">
                                <Input
                                  aria-invalid={fieldState.invalid}
                                  disabled={updateSettingsMutation.isPending}
                                  placeholder={t(
                                    "toolSettingsInvocationUrlPlaceholder",
                                  )}
                                  {...invocationUrlField}
                                />
                                {fieldState.error?.message && (
                                  <p className="text-sm text-destructive">
                                    {fieldState.error.message}
                                  </p>
                                )}
                              </div>
                            )}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 border-t border-border pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="grid gap-1">
                      <h3 className="text-sm font-medium">
                        {t("toolSettingsSchemaTitle")}
                      </h3>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addSchemaField(index)}
                      disabled={updateSettingsMutation.isPending}
                    >
                      <Plus />
                      {t("toolSettingsAddSchemaField")}
                    </Button>
                  </div>

                  <div className="grid gap-3">
                    {schemaFields.map((schemaField, schemaFieldIndex) => {
                      const requiredFieldCount = schemaFields.filter(
                        (field) => field.required,
                      ).length;
                      const isLastRequiredField =
                        schemaField.required && requiredFieldCount <= 1;

                      return (
                      <div
                        key={`${field.id}-${schemaFieldIndex}`}
                        className="grid gap-3 rounded-lg bg-muted/40 p-3 lg:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1.2fr)_minmax(0,1fr)_auto_auto] lg:items-end"
                      >
                        <div className="grid gap-2">
                          <Label>
                            {t("toolSettingsSchemaFieldName")}
                          </Label>
                          <Controller
                            control={form.control}
                            name={`tools.${index}.schema.fields.${schemaFieldIndex}.name`}
                            rules={{
                              required: t("toolSettingsSchemaFieldNameRequired"),
                            }}
                            render={({ field: schemaNameField, fieldState }) => (
                              <div className="grid gap-2">
                                <Input
                                  aria-invalid={fieldState.invalid}
                                  disabled={updateSettingsMutation.isPending}
                                  placeholder={t(
                                    "toolSettingsSchemaFieldNamePlaceholder",
                                  )}
                                  {...schemaNameField}
                                />
                                {fieldState.error?.message && (
                                  <p className="text-sm text-destructive">
                                    {fieldState.error.message}
                                  </p>
                                )}
                              </div>
                            )}
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label>{t("toolSettingsSchemaFieldType")}</Label>
                          <Controller
                            control={form.control}
                            name={`tools.${index}.schema.fields.${schemaFieldIndex}.type`}
                            render={({ field: schemaTypeField }) => (
                              <Select
                                disabled={updateSettingsMutation.isPending}
                                {...schemaTypeField}
                              >
                                {TOOL_SCHEMA_FIELD_TYPES.map((type) => (
                                  <option key={type} value={type}>
                                    {t(`toolSchemaType.${type}`)}
                                  </option>
                                ))}
                              </Select>
                            )}
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label>
                            {t("toolSettingsSchemaFieldDescription")}
                          </Label>
                          <Controller
                            control={form.control}
                            name={`tools.${index}.schema.fields.${schemaFieldIndex}.description`}
                            rules={{
                              required: t(
                                "toolSettingsSchemaFieldDescriptionRequired",
                              ),
                            }}
                            render={({
                              field: schemaDescriptionField,
                              fieldState,
                            }) => (
                              <div className="grid gap-2">
                                <Input
                                  aria-invalid={fieldState.invalid}
                                  disabled={updateSettingsMutation.isPending}
                                  placeholder={t(
                                    "toolSettingsSchemaFieldDescriptionPlaceholder",
                                  )}
                                  {...schemaDescriptionField}
                                />
                                {fieldState.error?.message && (
                                  <p className="text-sm text-destructive">
                                    {fieldState.error.message}
                                  </p>
                                )}
                              </div>
                            )}
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label>
                            {t("toolSettingsSchemaFieldDefaultValue")}
                          </Label>
                          <Controller
                            control={form.control}
                            name={`tools.${index}.schema.fields.${schemaFieldIndex}.defaultValue`}
                            render={({ field: schemaDefaultValueField }) => (
                              <Input
                                disabled={updateSettingsMutation.isPending}
                                placeholder={t(
                                  "toolSettingsSchemaFieldDefaultValuePlaceholder",
                                )}
                                {...schemaDefaultValueField}
                              />
                            )}
                          />
                        </div>

                        <Controller
                          control={form.control}
                          name={`tools.${index}.schema.fields.${schemaFieldIndex}.required`}
                          render={({ field: requiredField }) => (
                            <label className="flex h-9 items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={requiredField.value}
                                onChange={(event) =>
                                  requiredField.onChange(event.target.checked)
                                }
                                disabled={
                                  updateSettingsMutation.isPending ||
                                  (requiredField.value && requiredFieldCount <= 1)
                                }
                              />
                              {t("toolSettingsSchemaFieldRequired")}
                            </label>
                          )}
                        />

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t("toolSettingsRemoveSchemaField")}
                          onClick={() =>
                            removeSchemaField(index, schemaFieldIndex)
                          }
                          disabled={
                            updateSettingsMutation.isPending ||
                            schemaFields.length <= 1 ||
                            isLastRequiredField
                          }
                        >
                          <Trash2 />
                        </Button>
                      </div>
                      );
                    })}

                    {schemaFields.length === 0 && (
                      <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                        {t("toolSettingsSchemaEmpty")}
                      </div>
                    )}
                  </div>
                </div>
                  </div>
                )}
              </div>
            );
          })}

          {fields.length === 0 && (
            <div className="grid min-h-32 content-center gap-2 rounded-lg border border-dashed border-border p-6 text-center">
              <h2 className="text-sm font-medium">
                {t("toolSettingsEmptyTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("toolSettingsEmptyDescription")}
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="flex justify-end gap-2 border-t border-border pt-8">
        <Button type="submit" disabled={updateSettingsMutation.isPending}>
          {t("toolSettingsSave")}
        </Button>
      </div>
    </form>
  );
}
