import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { resetSettings, updateSettings } from "@/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { TextEditor } from "@/components/ui/text_editor";
import { UTC_OFFSET_TIME_ZONES, type SettingsResponse } from "../../../../shared/const";

type SystemPromptSettingsForm = Pick<SettingsResponse, "globalPrompt" | "timeZone">;

type SystemPromptSettingsTabProps = {
  settings: SettingsResponse;
};

export function SystemPromptSettingsTab({ settings }: SystemPromptSettingsTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [resetConfirming, setResetConfirming] = useState(false);
  const form = useForm<SystemPromptSettingsForm>({
    defaultValues: {
      globalPrompt: settings.globalPrompt,
      timeZone: settings.timeZone,
    },
  });
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

      <section className="grid gap-4 border-t border-border pt-8">
        <div className="grid gap-1">
          <Label>{t("basicSettingsResetTitle")}</Label>
          <p className="text-sm text-muted-foreground">
            {t("basicSettingsResetDescription")}
          </p>
        </div>
        {resetConfirming ? (
          <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-destructive">
              {t("basicSettingsResetConfirmDescription")}
            </p>
            <div className="flex shrink-0 gap-2">
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
                {t("basicSettingsResetConfirm")}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => setResetConfirming(true)}
            >
              {t("basicSettingsReset")}
            </Button>
          </div>
        )}
      </section>

      <div className="flex justify-end gap-2 border-t border-border pt-8">
        <Button type="submit" disabled={pending}>
          {t("promptSave")}
        </Button>
      </div>
    </form>
  );
}
