import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { Camera, LoaderCircle, Trash2 } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OpeningPreview } from "@/components/chat/opening-preview";
import { Switch } from "@/components/ui/switch";
import { TextEditor } from "@/components/ui/text_editor";
import { useUnsavedChangesPrompt } from "@/hooks/use-unsaved-changes-prompt";
import { uploadAssistantAvatar } from "@/api";
import type { ClientDialogSettings } from "../../../../shared/client";

type DialogSettingsForm = ClientDialogSettings;

type DialogSettingsTabProps = {
  settings: DialogSettingsForm;
  onSave: (values: DialogSettingsForm) => Promise<DialogSettingsForm>;
};

const toFormValues = (settings: DialogSettingsForm): DialogSettingsForm => ({
  assistantIdentityEnabled: settings.assistantIdentityEnabled,
  assistantNickname: settings.assistantNickname,
  assistantAvatar: settings.assistantAvatar,
  dialogOpeningMessage: settings.dialogOpeningMessage,
  dialogInputMaxLength: settings.dialogInputMaxLength,
  dialogPlaceholder: settings.dialogPlaceholder,
  dialogSpeechEnabled: settings.dialogSpeechEnabled,
  dialogImageEnabled: settings.dialogImageEnabled,
});

export function DialogSettingsTab({ settings, onSave }: DialogSettingsTabProps) {
  const { t } = useTranslation();
  const avatarInputRef = useRef<HTMLInputElement>(null);
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
        assistantIdentityEnabled: values.assistantIdentityEnabled,
        assistantNickname: values.assistantNickname,
        assistantAvatar: values.assistantAvatar,
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

  const avatarUpload = useMutation({
    mutationFn: uploadAssistantAvatar,
    onSuccess: (url) => form.setValue("assistantAvatar", url, { shouldDirty: true }),
    onError: () => toast.error(t("assistantAvatarUploadFailed")),
  });

  const avatarDisabled = avatarUpload.isPending || updateSettingsMutation.isPending;

  const onSubmit = (values: DialogSettingsForm) => {
    if (values.assistantIdentityEnabled && !values.assistantNickname.trim()) {
      form.setError("assistantNickname", { message: t("assistantNicknameRequired") }, { shouldFocus: true });
      return;
    }
    form.clearErrors("assistantNickname");
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
      <section className="grid max-w-sm gap-5">
        <div className="flex w-fit items-center gap-3">
          <Label htmlFor="assistant-identity-enabled">{t("assistantIdentityEnabled")}</Label>
          <Controller control={form.control} name="assistantIdentityEnabled" render={({ field }) => (
            <Switch id="assistant-identity-enabled" checked={field.value} disabled={avatarDisabled}
              onCheckedChange={(value) => { field.onChange(value); form.clearErrors("assistantNickname"); }} />
          )} />
        </div>
        {watchedSettings.assistantIdentityEnabled && <>

        <div className="grid justify-items-start gap-2">
          <span className="text-sm font-medium" id="assistant-avatar-label">{t("assistantAvatar")}</span>
          <div className="relative size-24 overflow-hidden rounded-full border border-input bg-background"
            role="group" aria-labelledby="assistant-avatar-label" aria-busy={avatarUpload.isPending}>
            {watchedSettings.assistantAvatar ? (
              <>
                <img src={watchedSettings.assistantAvatar} alt={t("assistantAvatar")} className="size-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex h-9 justify-center bg-black/65 text-white">
                  <button type="button" className="flex w-10 items-center justify-center hover:bg-white/20 focus-visible:bg-white/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:text-white/40"
                    aria-label={t("assistantAvatarUpload")} title={t("assistantAvatarUpload")}
                    disabled={avatarDisabled} onClick={() => avatarInputRef.current?.click()}>
                    <Camera className="size-4" aria-hidden="true" />
                  </button>
                  <button type="button" className="flex w-10 items-center justify-center hover:bg-white/20 focus-visible:bg-white/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:text-white/40"
                    aria-label={t("assistantAvatarRemove")} title={t("assistantAvatarRemove")}
                    disabled={avatarDisabled} onClick={() => form.setValue("assistantAvatar", "", { shouldDirty: true })}>
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </>
            ) : (
              <button type="button" className="flex size-full items-center justify-center text-primary transition-colors hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                aria-label={t("assistantAvatarUpload")} title={t("assistantAvatarUpload")}
                aria-describedby="assistant-avatar-description"
                disabled={avatarDisabled} onClick={() => avatarInputRef.current?.click()}>
                <Camera className="size-7" aria-hidden="true" />
              </button>
            )}
            {avatarUpload.isPending && (
              <div role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/80">
                <LoaderCircle className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
                <span className="sr-only">{t("assistantAvatarUploading")}</span>
              </div>
            )}
          </div>
          <input ref={avatarInputRef} type="file" className="hidden" accept="image/png,image/jpeg,image/gif,image/webp"
            disabled={avatarDisabled}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (file.size > 2 * 1024 * 1024 || !["image/png", "image/jpeg", "image/gif", "image/webp"].includes(file.type)) {
                toast.error(t("assistantAvatarDescription"));
                return;
              }
              avatarUpload.mutate(file);
            }} />
          <p id="assistant-avatar-description" className="text-xs text-muted-foreground">{t("assistantAvatarDescription")}</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="assistant-nickname">{t("assistantNickname")}</Label>
          <Input id="assistant-nickname" required aria-invalid={!!form.formState.errors.assistantNickname} maxLength={100} disabled={updateSettingsMutation.isPending} {...form.register("assistantNickname")} />
          {form.formState.errors.assistantNickname && <p role="alert" className="text-sm text-destructive">{form.formState.errors.assistantNickname.message}</p>}
        </div>
        </>}
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
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <div className="grid content-start gap-2">
            <Controller control={form.control} name="dialogOpeningMessage" render={({ field }) => (
              <TextEditor id="dialog-opening-message" className="min-h-96 font-mono"
                disabled={updateSettingsMutation.isPending} placeholder={t("promptDialogOpeningMessagePlaceholder")} {...field} />
            )} />
            <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="w-fit" disabled={updateSettingsMutation.isPending}
              onClick={() => form.setValue("dialogOpeningMessage", `${form.getValues("dialogOpeningMessage")}\n\n:::recommended-replies\n- ${t("chatOpeningExampleReply")}\n:::`.trim(), { shouldDirty: true })}>
              {t("chatOpeningInsertBlock")}
            </Button>
              <Button type="button" variant="outline" disabled={updateSettingsMutation.isPending}
                onClick={() => form.setValue("dialogOpeningMessage", `${form.getValues("dialogOpeningMessage")}\n\n:::notice info\n${t("chatOpeningExampleNotice")}\n:::`.trim(), { shouldDirty: true })}>
                {t("chatOpeningInsertNotice")}
              </Button>
              <Button type="button" variant="outline" disabled={updateSettingsMutation.isPending}
                onClick={() => form.setValue("dialogOpeningMessage", `${form.getValues("dialogOpeningMessage")}\n\n:::system\n${t("chatOpeningExampleSystem")}\n:::`.trim(), { shouldDirty: true })}>
                {t("chatOpeningInsertSystem")}
              </Button>
            </div>
          </div>
          <OpeningPreview identityEnabled={watchedSettings.assistantIdentityEnabled} markdown={watchedSettings.dialogOpeningMessage} nickname={watchedSettings.assistantNickname} avatar={watchedSettings.assistantAvatar} />
        </div>
      </section>

      <section className="grid gap-4 border-t border-border pt-8">
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
        <Button type="submit" disabled={updateSettingsMutation.isPending || avatarUpload.isPending}>
          {t("saveSettings")}
        </Button>
      </div>
    </form>
  );
}
