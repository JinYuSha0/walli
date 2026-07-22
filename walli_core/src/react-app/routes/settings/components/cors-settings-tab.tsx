import { useMutation } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { ClientCorsSettings } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CorsSettingsForm = {
  corsAllowedOrigins: Array<{
    url: string;
  }>;
};

type CorsSettingsTabProps = {
  settings: ClientCorsSettings;
  onSave: (values: ClientCorsSettings) => Promise<ClientCorsSettings>;
};

const toFormValues = (origins: string[]): CorsSettingsForm => ({
  corsAllowedOrigins: origins.map((url) => ({ url })),
});

const isValidOriginUrl = (value: string) => {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return true;
  }

  try {
    const url = new URL(trimmedValue);

    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.origin === trimmedValue.replace(/\/$/, "")
    );
  } catch {
    return false;
  }
};

export function CorsSettingsTab({ settings, onSave }: CorsSettingsTabProps) {
  const { t } = useTranslation();
  const form = useForm<CorsSettingsForm>({
    defaultValues: toFormValues(settings.corsAllowedOrigins),
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "corsAllowedOrigins",
  });
  const saveMutation = useMutation({
    mutationFn: onSave,
    onSuccess: (values) => {
      form.reset(toFormValues(values.corsAllowedOrigins));
      toast.success(t("corsSettingsSaveSuccess"));
    },
  });

  useEffect(() => {
    form.reset(toFormValues(settings.corsAllowedOrigins));
  }, [form, settings.corsAllowedOrigins]);

  const onSubmit = (values: CorsSettingsForm) => {
    saveMutation.mutate({
      corsAllowedOrigins: values.corsAllowedOrigins
        .map((origin) => origin.url.trim())
        .filter((url) => url.length > 0),
    });
  };

  return (
    <form className="grid gap-8" onSubmit={form.handleSubmit(onSubmit)}>
      <section className="grid gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-1">
            <h2 className="text-sm font-medium">{t("corsSettingsTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("corsSettingsDescription")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => append({ url: "" })}
            disabled={saveMutation.isPending}
          >
            <Plus />
            {t("corsSettingsAddOrigin")}
          </Button>
        </div>

        <div className="grid gap-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-2 rounded-lg border border-border p-4"
            >
              <Label htmlFor={`cors-origin-${field.id}`}>
                {t("corsSettingsOriginUrl")}
              </Label>
              <div className="flex items-start gap-2">
                <Controller
                  control={form.control}
                  name={`corsAllowedOrigins.${index}.url`}
                  rules={{
                    validate: (value) =>
                      isValidOriginUrl(value) || t("corsSettingsOriginUrlInvalid"),
                  }}
                  render={({ field: urlField, fieldState }) => (
                    <div className="grid flex-1 gap-2">
                      <Input
                        id={`cors-origin-${field.id}`}
                        aria-invalid={fieldState.invalid}
                        disabled={saveMutation.isPending}
                        placeholder={t("corsSettingsOriginUrlPlaceholder")}
                        {...urlField}
                      />
                      {fieldState.error?.message && (
                        <p className="text-sm text-destructive">
                          {fieldState.error.message}
                        </p>
                      )}
                    </div>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("corsSettingsRemoveOrigin")}
                  onClick={() => remove(index)}
                  disabled={saveMutation.isPending}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}

          {fields.length === 0 && (
            <div className="grid min-h-32 content-center gap-2 rounded-lg border border-dashed border-border p-6 text-center">
              <h2 className="text-sm font-medium">
                {t("corsSettingsEmptyTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("corsSettingsEmptyDescription")}
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="flex justify-end gap-2 border-t border-border pt-8">
        <Button type="submit" disabled={saveMutation.isPending}>
          {t("corsSettingsSave")}
        </Button>
      </div>
    </form>
  );
}
