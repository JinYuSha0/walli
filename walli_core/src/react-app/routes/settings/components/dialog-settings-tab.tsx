import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { updateSettings } from "@/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MarkdownEditor } from "@/components/ui/markdown_editor";
import { Switch } from "@/components/ui/switch";
import { TextEditor } from "@/components/ui/text_editor";
import type { Settings } from "../../../../shared/const";

type DialogSettingsForm = Pick<
  Settings,
  | "dialogSystemPrompt"
  | "dialogOpeningMessage"
  | "dialogSpeechEnabled"
  | "dialogImageEnabled"
>;

type DialogSettingsTabProps = {
  settings: Settings;
};

export function DialogSettingsTab({ settings }: DialogSettingsTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm<DialogSettingsForm>({
    defaultValues: {
      dialogSystemPrompt: settings.dialogSystemPrompt,
      dialogOpeningMessage: settings.dialogOpeningMessage,
      dialogSpeechEnabled: settings.dialogSpeechEnabled,
      dialogImageEnabled: settings.dialogImageEnabled,
    },
  });
  const updateSettingsMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (values) => {
      queryClient.setQueryData(["settings"], values);
      form.reset({
        dialogSystemPrompt: values.dialogSystemPrompt,
        dialogOpeningMessage: values.dialogOpeningMessage,
        dialogSpeechEnabled: values.dialogSpeechEnabled,
        dialogImageEnabled: values.dialogImageEnabled,
      });
      toast.success(t("promptSaveSuccess"));
    },
  });

  useEffect(() => {
    form.reset({
      dialogSystemPrompt: settings.dialogSystemPrompt,
      dialogOpeningMessage: settings.dialogOpeningMessage,
      dialogSpeechEnabled: settings.dialogSpeechEnabled,
      dialogImageEnabled: settings.dialogImageEnabled,
    });
  }, [
    form,
    settings.dialogImageEnabled,
    settings.dialogOpeningMessage,
    settings.dialogSpeechEnabled,
    settings.dialogSystemPrompt,
  ]);

  const onSubmit = (values: DialogSettingsForm) => {
    updateSettingsMutation.mutate(values);
  };

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
