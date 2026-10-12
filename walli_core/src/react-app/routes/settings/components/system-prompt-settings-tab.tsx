import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { updateSettings } from "@/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SlashMarkdownEditor } from "@/components/ui/slash-markdown-editor";
import { useUnsavedChangesPrompt } from "@/hooks/use-unsaved-changes-prompt";
import { type SettingsResponse } from "../../../../shared/const";

type SystemPromptSettingsForm = Pick<SettingsResponse, "globalPrompt">;

export function SystemPromptSettingsTab({ settings }: { settings: SettingsResponse }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const savedSettings: SystemPromptSettingsForm = { globalPrompt: settings.globalPrompt };
  const form = useForm<SystemPromptSettingsForm>({ defaultValues: savedSettings });
  const watchedSettings = useWatch({ control: form.control, defaultValue: savedSettings });
  const updateSettingsMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (values) => {
      queryClient.setQueryData(["settings"], values);
      form.reset({ globalPrompt: values.globalPrompt });
      toast.success(t("promptSaveSuccess"));
    },
  });
  useEffect(() => {
    form.reset({ globalPrompt: settings.globalPrompt });
  }, [form, settings.globalPrompt]);
  const pending = updateSettingsMutation.isPending;
  useUnsavedChangesPrompt({ current: watchedSettings, saved: savedSettings, disabled: pending });

  return (
    <form className="grid gap-8" onSubmit={form.handleSubmit((values) => updateSettingsMutation.mutate(values))}>
      <section className="grid gap-3">
        <div className="grid gap-1">
          <Label id="system-prompt-label" htmlFor="system-prompt">
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
              <SlashMarkdownEditor
                id="system-prompt"
                invalid={fieldState.invalid}
                disabled={pending}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
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

      <div className="flex justify-end border-t border-border pt-8">
        <Button type="submit" disabled={pending}>{t("saveSettings")}</Button>
      </div>
    </form>
  );
}
