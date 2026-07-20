import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { updateSettings } from "@/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TextEditor } from "@/components/ui/text_editor";
import type { SettingsResponse } from "../../../../shared/const";

type SystemPromptSettingsForm = Pick<SettingsResponse, "globalPrompt">;

type SystemPromptSettingsTabProps = {
  settings: SettingsResponse;
};

export function SystemPromptSettingsTab({ settings }: SystemPromptSettingsTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm<SystemPromptSettingsForm>({
    defaultValues: {
      globalPrompt: settings.globalPrompt,
    },
  });
  const updateSettingsMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (values) => {
      queryClient.setQueryData(["settings"], values);
      form.reset({
        globalPrompt: values.globalPrompt,
      });
      toast.success(t("promptSaveSuccess"));
    },
  });

  useEffect(() => {
    form.reset({
      globalPrompt: settings.globalPrompt,
    });
  }, [form, settings.globalPrompt]);

  const onSubmit = (values: SystemPromptSettingsForm) => {
    updateSettingsMutation.mutate(values);
  };

  return (
    <form className="grid gap-8" onSubmit={form.handleSubmit(onSubmit)}>
      <section className="grid gap-3">
        <div className="grid gap-1">
          <Label>{t("basicSettingsApiTokenTitle")}</Label>
          <p className="text-sm text-muted-foreground">
            {t("basicSettingsApiTokenDescription")}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm">
          {settings.apiTokenMask || t("basicSettingsApiTokenEmpty")}
        </div>
      </section>

      <section className="grid gap-3">
        <div className="grid gap-1">
          <Label htmlFor="system-prompt">
            {t("promptGlobalPromptTitle")}
          </Label>
          <p className="text-sm text-muted-foreground">
            {t("promptGlobalPromptDescription")}
          </p>
        </div>
        <Controller
          control={form.control}
          name="globalPrompt"
          render={({ field, fieldState }) => (
            <div className="grid gap-2">
              <TextEditor
                id="system-prompt"
                aria-invalid={fieldState.invalid}
                disabled={updateSettingsMutation.isPending}
                placeholder={t("promptGlobalPromptPlaceholder")}
                {...field}
              />
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
          {t("promptSave")}
        </Button>
      </div>
    </form>
  );
}
