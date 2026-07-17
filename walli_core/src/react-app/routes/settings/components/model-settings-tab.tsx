import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { updateSettings } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  MODEL_CAPABILITY_TAGS,
  type ModelCapabilityTag,
  type Settings,
} from "../../../../shared/const";

type ModelSettingsForm = Pick<
  Settings,
  "models" | "primaryModel" | "embeddingModel"
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
  const form = useForm<ModelSettingsForm>({
    defaultValues: {
      models: settings.models,
      primaryModel: settings.primaryModel,
      embeddingModel: settings.embeddingModel,
    },
  });
  const watchedModels = form.watch("models");
  const watchedPrimaryModel = form.watch("primaryModel");
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
        embeddingModel: values.embeddingModel,
      });
      toast.success(t("modelSettingsSaveSuccess"));
    },
  });

  useEffect(() => {
    form.reset({
      models: settings.models,
      primaryModel: settings.primaryModel,
      embeddingModel: settings.embeddingModel,
    });
  }, [form, settings.models, settings.primaryModel, settings.embeddingModel]);

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
      embeddingModel: values.embeddingModel,
    });
  };

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
            disabled={updateSettingsMutation.isPending}
          >
            <Plus />
            {t("modelSettingsAddModel")}
          </Button>
        </div>

        <div className="grid gap-4">
          {fields.map((field, index) => {
            const modelName = watchedModels[index]?.name.trim() ?? "";
            const usingToolNames = settings.tools
              .filter(
                (tool) =>
                  tool.invocation.type === "model" &&
                  tool.invocation.model === modelName,
              )
              .map((tool) => tool.name);
            const isSelectedModel =
              modelName.length > 0 &&
              (modelName === watchedPrimaryModel ||
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
                            disabled={updateSettingsMutation.isPending}
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
                      disabled={updateSettingsMutation.isPending || index === 0}
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
                        updateSettingsMutation.isPending ||
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
                          disabled={updateSettingsMutation.isPending}
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
                              disabled={updateSettingsMutation.isPending}
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
              <select
                id="primary-model"
                className="h-9 w-full rounded-lg border border-input bg-input/30 px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={t("modelSettingsPrimaryModel")}
                aria-invalid={fieldState.invalid}
                disabled={updateSettingsMutation.isPending}
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
              </select>
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
              <select
                id="embedding-model"
                className="h-9 w-full rounded-lg border border-input bg-input/30 px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={t("modelSettingsEmbeddingModel")}
                aria-invalid={fieldState.invalid}
                disabled={updateSettingsMutation.isPending}
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
              </select>
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
        <Button type="submit" disabled={updateSettingsMutation.isPending}>
          {t("modelSettingsSave")}
        </Button>
      </div>
    </form>
  );
}
