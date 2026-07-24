import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { updateSettings } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUnsavedChangesPrompt } from "@/hooks/use-unsaved-changes-prompt";
import { cn } from "@/lib/utils";
import {
  DEFAULT_SETTINGS,
  MODEL_CAPABILITY_TAGS,
  type ModelCapabilityTag,
  type Settings,
} from "../../../../shared/const";

type ModelSettingsForm = Pick<
  Settings,
  "models" | "primaryModel" | "toolPlannerModel" | "embeddingModel"
>;

type ModelSettingsTabProps = {
  settings: Settings;
};

const createEmptyModel = () => ({
  name: "",
  tags: [] as ModelCapabilityTag[],
});

const supportsPrimaryModel = (tags: ModelCapabilityTag[]) =>
  tags.includes("text-generation") && tags.includes("tool-calling");

const supportsEmbeddingModel = (tags: ModelCapabilityTag[]) =>
  tags.includes("embedding");

export function ModelSettingsTab({ settings }: ModelSettingsTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [openDeleteTooltipId, setOpenDeleteTooltipId] = useState<string | null>(
    null,
  );
  const [resetConfirming, setResetConfirming] = useState(false);
  const form = useForm<ModelSettingsForm>({
    defaultValues: {
      models: settings.models,
      primaryModel: settings.primaryModel,
      toolPlannerModel: settings.toolPlannerModel,
      embeddingModel: settings.embeddingModel,
    },
  });
  const watchedModels = form.watch("models");
  const watchedPrimaryModel = form.watch("primaryModel");
  const watchedToolPlannerModel = form.watch("toolPlannerModel");
  const watchedEmbeddingModel = form.watch("embeddingModel");
  const primaryModelOptions = useMemo(
    () =>
      watchedModels
        .map((model) => ({
          ...model,
          name: model.name.trim(),
        }))
        .filter(
          (model) => model.name.length > 0 && supportsPrimaryModel(model.tags),
        ),
    [watchedModels],
  );
  const embeddingModelOptions = useMemo(
    () =>
      watchedModels
        .map((model) => ({
          ...model,
          name: model.name.trim(),
        }))
        .filter(
          (model) =>
            model.name.length > 0 && supportsEmbeddingModel(model.tags),
        ),
    [watchedModels],
  );
  const toolPlannerModelOptions = useMemo(
    () => primaryModelOptions,
    [primaryModelOptions],
  );
  const { fields, append, move, remove } = useFieldArray({
    control: form.control,
    name: "models",
  });
  const updateSettingsMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (values) => {
      queryClient.setQueryData(["settings"], values);
      form.reset({
        models: values.models,
        primaryModel: values.primaryModel,
        toolPlannerModel: values.toolPlannerModel,
        embeddingModel: values.embeddingModel,
      });
      toast.success(t("modelSettingsSaveSuccess"));
    },
  });
  const resetSettingsMutation = useMutation({
    mutationFn: () =>
      updateSettings({
        models: DEFAULT_SETTINGS.models,
        primaryModel: DEFAULT_SETTINGS.primaryModel,
        toolPlannerModel: DEFAULT_SETTINGS.toolPlannerModel,
        embeddingModel: DEFAULT_SETTINGS.embeddingModel,
      }),
    onSuccess: (values) => {
      queryClient.setQueryData(["settings"], values);
      form.reset({
        models: values.models,
        primaryModel: values.primaryModel,
        toolPlannerModel: values.toolPlannerModel,
        embeddingModel: values.embeddingModel,
      });
      setResetConfirming(false);
      toast.success(t("modelSettingsResetSuccess"));
    },
  });
  const pending = updateSettingsMutation.isPending || resetSettingsMutation.isPending;

  useEffect(() => {
    form.reset({
      models: settings.models,
      primaryModel: settings.primaryModel,
      toolPlannerModel: settings.toolPlannerModel,
      embeddingModel: settings.embeddingModel,
    });
  }, [
    form,
    settings.models,
    settings.primaryModel,
    settings.toolPlannerModel,
    settings.embeddingModel,
  ]);

  const toggleTag = (
    tags: ModelCapabilityTag[],
    tag: ModelCapabilityTag,
    onChange: (tags: ModelCapabilityTag[]) => void,
  ) => {
    onChange(
      tags.includes(tag)
        ? tags.filter((currentTag) => currentTag !== tag)
        : [...tags, tag],
    );
  };

  const onSubmit = (values: ModelSettingsForm) => {
    const models = values.models
      .map((model) => ({
        name: model.name.trim(),
        tags: model.tags,
      }))
      .filter((model) => model.name.length > 0);

    updateSettingsMutation.mutate({
      models,
      primaryModel: values.primaryModel,
      toolPlannerModel: values.toolPlannerModel,
      embeddingModel: values.embeddingModel,
    });
  };
  useUnsavedChangesPrompt({
    current: {
      models: watchedModels,
      primaryModel: watchedPrimaryModel,
      toolPlannerModel: watchedToolPlannerModel,
      embeddingModel: watchedEmbeddingModel,
    },
    saved: {
      models: settings.models,
      primaryModel: settings.primaryModel,
      toolPlannerModel: settings.toolPlannerModel,
      embeddingModel: settings.embeddingModel,
    },
    disabled: pending,
  });

  return (
    <form className="grid gap-8" onSubmit={form.handleSubmit(onSubmit)}>
      <section className="grid gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-1">
            <h2 className="text-sm font-medium">{t("modelSettingsTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("modelSettingsDescription")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => append(createEmptyModel())}
            disabled={pending}
          >
            <Plus />
            {t("modelSettingsAddModel")}
          </Button>
        </div>

        <div className="grid gap-4">
          {fields.map((field, index) => {
            const modelName = watchedModels[index]?.name.trim() ?? "";
            const usingToolNames = [...settings.builtInTools, ...settings.tools]
              .filter(
                (tool) =>
                  tool.invocation.type === "model" &&
                  tool.invocation.model === modelName,
              )
              .map((tool) => tool.name);
            const isSelectedModel =
              modelName.length > 0 &&
              (modelName === watchedPrimaryModel ||
                modelName === watchedToolPlannerModel ||
                modelName === watchedEmbeddingModel);
            const deleteDisabledReason = isSelectedModel
              ? t("modelSettingsRemoveSelectedModelDisabled")
              : usingToolNames.length > 0
                ? t("modelSettingsRemoveToolUsingModelDisabled", {
                  toolNames: usingToolNames.join(", "),
                })
                : "";
            const canRemoveModel = deleteDisabledReason.length === 0;

            return (
              <div
                key={field.id}
                className="grid gap-4 rounded-lg border border-border p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="grid flex-1 gap-2">
                    <Label htmlFor={`model-name-${field.id}`}>
                      {t("modelSettingsModelName")}
                    </Label>
                    <Controller
                      control={form.control}
                      name={`models.${index}.name`}
                      rules={{ required: t("modelSettingsModelNameRequired") }}
                      render={({ field: nameField, fieldState }) => (
                        <div className="grid gap-2">
                          <Input
                            id={`model-name-${field.id}`}
                            aria-invalid={fieldState.invalid}
                            disabled={pending}
                            placeholder={t("modelSettingsModelNamePlaceholder")}
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
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("modelSettingsMoveUp")}
                      onClick={() => move(index, index - 1)}
                      disabled={pending || index === 0}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("modelSettingsMoveDown")}
                      onClick={() => move(index, index + 1)}
                      disabled={
                        pending ||
                        index === fields.length - 1
                      }
                    >
                      <ArrowDown />
                    </Button>
                    <Tooltip
                      open={openDeleteTooltipId === field.id}
                      onOpenChange={(open) =>
                        setOpenDeleteTooltipId(open ? field.id : null)
                      }
                    >
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-disabled={!canRemoveModel}
                          aria-label={
                            deleteDisabledReason ||
                            t("modelSettingsRemoveModel")
                          }
                          className={!canRemoveModel ? "opacity-50" : undefined}
                          onClick={() => {
                            if (!canRemoveModel) {
                              setOpenDeleteTooltipId(field.id);
                              return;
                            }

                            remove(index);
                          }}
                          disabled={pending}
                        >
                          <Trash2 />
                        </Button>
                      </TooltipTrigger>
                      {deleteDisabledReason.length > 0 && (
                        <TooltipContent>{deleteDisabledReason}</TooltipContent>
                      )}
                    </Tooltip>
                  </div>
                </div>

                <Controller
                  control={form.control}
                  name={`models.${index}.tags`}
                  render={({ field: tagsField }) => (
                    <div className="grid gap-2">
                      <Label>{t("modelSettingsTags")}</Label>
                      <div className="flex flex-wrap gap-2">
                        {MODEL_CAPABILITY_TAGS.map((tag) => {
                          const selected = tagsField.value.includes(tag);

                          return (
                            <Button
                              key={tag}
                              type="button"
                              variant={selected ? "default" : "outline"}
                              size="sm"
                              className={cn(
                                "rounded-full",
                                selected && "hover:bg-primary/90",
                              )}
                              onClick={() =>
                                toggleTag(
                                  tagsField.value,
                                  tag,
                                  tagsField.onChange,
                                )
                              }
                              disabled={pending}
                            >
                              {t(`modelCapability.${tag}`)}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                />
              </div>
            );
          })}

          {fields.length === 0 && (
            <div className="grid min-h-32 content-center gap-2 rounded-lg border border-dashed border-border p-6 text-center">
              <h2 className="text-sm font-medium">
                {t("modelSettingsEmptyTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("modelSettingsEmptyDescription")}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 border-t border-border pt-8">
        <div className="grid gap-1">
          <h2 className="text-sm font-medium">
            {t("modelSettingsPrimaryModelTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("modelSettingsPrimaryModelDescription")}
          </p>
        </div>

        <Controller
          control={form.control}
          name="primaryModel"
          rules={{
            required: t("modelSettingsPrimaryModelRequired"),
            validate: (value) =>
              primaryModelOptions.some((model) => model.name === value) ||
              t("modelSettingsPrimaryModelInvalid"),
          }}
          render={({ field, fieldState }) => (
            <div className="grid gap-2">
              <Select
                id="primary-model"
                aria-label={t("modelSettingsPrimaryModel")}
                aria-invalid={fieldState.invalid}
                disabled={pending}
                {...field}
              >
                <option value="">
                  {t("modelSettingsPrimaryModelPlaceholder")}
                </option>
                {primaryModelOptions.map((model) => (
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
      </section>

      <section className="grid gap-4 border-t border-border pt-8">
        <div className="grid gap-1">
          <h2 className="text-sm font-medium">
            {t("modelSettingsToolPlannerModelTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("modelSettingsToolPlannerModelDescription")}
          </p>
        </div>

        <Controller
          control={form.control}
          name="toolPlannerModel"
          rules={{
            required: t("modelSettingsToolPlannerModelRequired"),
            validate: (value) =>
              toolPlannerModelOptions.some((model) => model.name === value) ||
              t("modelSettingsToolPlannerModelInvalid"),
          }}
          render={({ field, fieldState }) => (
            <div className="grid gap-2">
              <Select
                id="tool-planner-model"
                aria-label={t("modelSettingsToolPlannerModel")}
                aria-invalid={fieldState.invalid}
                disabled={pending}
                {...field}
              >
                <option value="">
                  {t("modelSettingsToolPlannerModelPlaceholder")}
                </option>
                {toolPlannerModelOptions.map((model) => (
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
      </section>

      <section className="grid gap-4 border-t border-border pt-8">
        <div className="grid gap-1">
          <h2 className="text-sm font-medium">
            {t("modelSettingsEmbeddingModelTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("modelSettingsEmbeddingModelDescription")}
          </p>
        </div>

        <Controller
          control={form.control}
          name="embeddingModel"
          rules={{
            required: t("modelSettingsEmbeddingModelRequired"),
            validate: (value) =>
              embeddingModelOptions.some((model) => model.name === value) ||
              t("modelSettingsEmbeddingModelInvalid"),
          }}
          render={({ field, fieldState }) => (
            <div className="grid gap-2">
              <Select
                id="embedding-model"
                aria-label={t("modelSettingsEmbeddingModel")}
                aria-invalid={fieldState.invalid}
                disabled={pending}
                {...field}
              >
                <option value="">
                  {t("modelSettingsEmbeddingModelPlaceholder")}
                </option>
                {embeddingModelOptions.map((model) => (
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
      </section>

      <div className="flex justify-end gap-2 border-t border-border pt-8">
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={() => setResetConfirming(true)}
        >
          <RefreshCcw />
          {t("modelSettingsReset")}
        </Button>
        {resetConfirming ? (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-sm"
            role="presentation"
          >
            <div
              aria-modal="true"
              className="grid w-full max-w-md gap-5 rounded-lg border border-border bg-background p-6 shadow-lg"
              role="dialog"
            >
              <div className="grid gap-2">
                <h2 className="text-lg font-semibold">{t("modelSettingsResetTitle")}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("modelSettingsResetConfirmDescription")}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setResetConfirming(false)}
                >
                  {t("modelSettingsResetCancel")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => resetSettingsMutation.mutate()}
                >
                  <RefreshCcw />
                  {t("modelSettingsResetConfirm")}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        <Button type="submit" disabled={pending}>
          {t("modelSettingsSave")}
        </Button>
      </div>
    </form>
  );
}
