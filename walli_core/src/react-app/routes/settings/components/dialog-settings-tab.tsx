import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarkdownEditor } from "@/components/ui/markdown_editor";
import { Switch } from "@/components/ui/switch";
import { TextEditor } from "@/components/ui/text_editor";
import { useUnsavedChangesPrompt } from "@/hooks/use-unsaved-changes-prompt";
import type { ClientDialogSettings } from "../../../../shared/client";

type DialogSettingsForm = ClientDialogSettings;

type DialogSettingsTabProps = {
  settings: DialogSettingsForm;
  onSave: (values: DialogSettingsForm) => Promise<DialogSettingsForm>;
};

const toFormValues = (settings: DialogSettingsForm): DialogSettingsForm => ({
  dialogSystemPrompt: settings.dialogSystemPrompt,
  dialogOpeningMessage: settings.dialogOpeningMessage,
  dialogInputMaxLength: settings.dialogInputMaxLength,
  dialogPlaceholder: settings.dialogPlaceholder,
  dialogSpeechEnabled: settings.dialogSpeechEnabled,
  dialogImageEnabled: settings.dialogImageEnabled,
});

export function DialogSettingsTab({ settings, onSave }: DialogSettingsTabProps) {
  const { t } = useTranslation();
  const savedSettings = useMemo(() => toFormValues(settings), [settings]);
  const form = useForm<DialogSettingsForm>({
    defaultValues: savedSettings,
  });
  const watchedSettings = useWatch({
    control: form.control,
    defaultValue: savedSettings,
  }) as DialogSettingsForm;
  const updateSettingsMutation = useMutation({
    mutationFn: onSave,
    onSuccess: (values) => {
      form.reset({
        dialogSystemPrompt: values.dialogSystemPrompt,
        dialogOpeningMessage: values.dialogOpeningMessage,
        dialogInputMaxLength: values.dialogInputMaxLength,
        dialogPlaceholder: values.dialogPlaceholder,
        dialogSpeechEnabled: values.dialogSpeechEnabled,
        dialogImageEnabled: values.dialogImageEnabled,
      });
      toast.success(t("promptSaveSuccess"));
    },
  });

  useEffect(() => {
    form.reset(savedSettings);
  }, [
    form,
    savedSettings,
  ]);

  const onSubmit = (values: DialogSettingsForm) => {
    updateSettingsMutation.mutate({
      ...values,
      dialogInputMaxLength: Math.max(1, values.dialogInputMaxLength),
    });
  };
  useUnsavedChangesPrompt({
    current: watchedSettings,
    saved: savedSettings,
    disabled: updateSettingsMutation.isPending,
  });

  return (
    <form className="grid gap-8" onSubmit={form.handleSubmit(onSubmit)}>
      <section className="grid gap-3">
        <div className="grid gap-1">
          <Label htmlFor="dialog-system-prompt">
            {t("promptDialogSystemPromptTitle")}
          </Label>
          <p className="text-sm text-muted-foreground">
            {t("promptDialogSystemPromptDescription")}
          </p>
        </div>
        <Controller
          control={form.control}
          name="dialogSystemPrompt"
          render={({ field }) => (
            <TextEditor
              id="dialog-system-prompt"
              disabled={updateSettingsMutation.isPending}
              placeholder={t("promptDialogSystemPromptPlaceholder")}
              {...field}
            />
          )}
        />
      </section>

      <section className="grid gap-3 border-t border-border pt-8">
        <div className="grid gap-1">
          <Label htmlFor="dialog-opening-message">
            {t("promptDialogOpeningMessageTitle")}
          </Label>
          <p className="text-sm text-muted-foreground">
            {t("promptDialogOpeningMessageDescription")}
          </p>
        </div>
        <Controller
          control={form.control}
          name="dialogOpeningMessage"
          render={({ field }) => (
            <MarkdownEditor
              id="dialog-opening-message"
              disabled={updateSettingsMutation.isPending}
              placeholder={t("promptDialogOpeningMessagePlaceholder")}
              {...field}
            />
          )}
        />
      </section>

      <section className="grid gap-4 border-t border-border pt-8">
        <div className="grid gap-1">
          <h2 className="text-sm font-medium">
            {t("promptDialogInputTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("promptDialogInputDescription")}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="dialog-input-max-length">
              {t("promptDialogInputMaxLengthTitle")}
            </Label>
            <Controller
              control={form.control}
              name="dialogInputMaxLength"
              render={({ field }) => (
                <Input
                  id="dialog-input-max-length"
                  type="number"
                  min={1}
                  step={1}
                  disabled={updateSettingsMutation.isPending}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={(event) => {
                    field.onChange(Number(event.target.value));
                  }}
                />
              )}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="dialog-placeholder">
              {t("promptDialogPlaceholderTitle")}
            </Label>
            <Controller
              control={form.control}
              name="dialogPlaceholder"
              render={({ field }) => (
                <Input
                  id="dialog-placeholder"
                  disabled={updateSettingsMutation.isPending}
                  placeholder={t("promptDialogPlaceholderPlaceholder")}
                  {...field}
                />
              )}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 border-t border-border pt-8">
        <div className="grid gap-1">
          <h2 className="text-sm font-medium">
            {t("promptDialogCapabilityTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("promptDialogCapabilityDescription")}
          </p>
        </div>

        <Controller
          control={form.control}
          name="dialogSpeechEnabled"
          render={({ field }) => (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
              <div className="grid gap-1">
                <Label htmlFor="dialog-speech-enabled">
                  {t("promptDialogSpeechEnabled")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("promptDialogSpeechEnabledDescription")}
                </p>
              </div>
              <Switch
                id="dialog-speech-enabled"
                checked={field.value}
                disabled={updateSettingsMutation.isPending}
                onCheckedChange={field.onChange}
              />
            </div>
          )}
        />

        <Controller
          control={form.control}
          name="dialogImageEnabled"
          render={({ field }) => (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
              <div className="grid gap-1">
                <Label htmlFor="dialog-image-enabled">
                  {t("promptDialogImageEnabled")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("promptDialogImageEnabledDescription")}
                </p>
              </div>
              <Switch
                id="dialog-image-enabled"
                checked={field.value}
                disabled={updateSettingsMutation.isPending}
                onCheckedChange={field.onChange}
              />
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
