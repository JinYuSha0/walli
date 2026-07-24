import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { resetSettings, updateSettings } from "@/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { TextEditor } from "@/components/ui/text_editor";
import { useUnsavedChangesPrompt } from "@/hooks/use-unsaved-changes-prompt";
import { UTC_OFFSET_TIME_ZONES, type SettingsResponse } from "../../../../shared/const";

type SystemPromptSettingsForm = Pick<SettingsResponse, "globalPrompt" | "timeZone">;

type SystemPromptSettingsTabProps = {
  settings: SettingsResponse;
};

export function SystemPromptSettingsTab({ settings }: SystemPromptSettingsTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [resetConfirming, setResetConfirming] = useState(false);
  const savedSettings: SystemPromptSettingsForm = {
    globalPrompt: settings.globalPrompt,
    timeZone: settings.timeZone,
  };
  const form = useForm<SystemPromptSettingsForm>({
    defaultValues: savedSettings,
  });
  const watchedSettings = useWatch({
    control: form.control,
    defaultValue: savedSettings,
  }) as SystemPromptSettingsForm;
  const updateSettingsMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (values) => {
      queryClient.setQueryData(["settings"], values);
      form.reset({
        globalPrompt: values.globalPrompt,
        timeZone: values.timeZone,
      });
      toast.success(t("promptSaveSuccess"));
    },
  });
  const resetSettingsMutation = useMutation({
    mutationFn: resetSettings,
    onSuccess: (values) => {
      queryClient.setQueryData(["settings"], values);
      form.reset({
        globalPrompt: values.globalPrompt,
        timeZone: values.timeZone,
      });
      setResetConfirming(false);
      toast.success(t("basicSettingsResetSuccess"));
    },
  });

  useEffect(() => {
    form.reset({
      globalPrompt: settings.globalPrompt,
      timeZone: settings.timeZone,
    });
  }, [form, settings.globalPrompt, settings.timeZone]);

  const onSubmit = (values: SystemPromptSettingsForm) => {
    updateSettingsMutation.mutate(values);
  };
  const pending = updateSettingsMutation.isPending || resetSettingsMutation.isPending;
  useUnsavedChangesPrompt({
    current: watchedSettings,
    saved: savedSettings,
    disabled: pending,
  });

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

      <section className="grid gap-3 border-t border-border pt-8">
        <div className="grid gap-1">
          <Label htmlFor="settings-time-zone">
            {t("basicSettingsTimeZoneTitle")}
          </Label>
          <p className="text-sm text-muted-foreground">
            {t("basicSettingsTimeZoneDescription")}
          </p>
        </div>
        <Controller
          control={form.control}
          name="timeZone"
          render={({ field, fieldState }) => (
            <div className="grid gap-2">
              <Select
                id="settings-time-zone"
                aria-invalid={fieldState.invalid}
                disabled={pending}
                {...field}
              >
                {UTC_OFFSET_TIME_ZONES.map((timeZone) => (
                  <option key={timeZone} value={timeZone}>
                    {timeZone}
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
                disabled={pending}
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
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={() => setResetConfirming(true)}
        >
          <RefreshCcw />
          {t("basicSettingsReset")}
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
                <h2 className="text-lg font-semibold">{t("basicSettingsResetTitle")}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("basicSettingsResetConfirmDescription")}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setResetConfirming(false)}
                >
                  {t("basicSettingsResetCancel")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => resetSettingsMutation.mutate()}
                >
                  <RefreshCcw />
                  {t("basicSettingsResetConfirm")}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        <Button type="submit" disabled={pending}>
          {t("promptSave")}
        </Button>
      </div>
    </form>
  );
}
