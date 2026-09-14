import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { ClientWebSettings } from "@/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUnsavedChangesPrompt } from "@/hooks/use-unsaved-changes-prompt";

export function WebSettingsTab({ settings, slug, onSave, turnstileConfigured }: {
  settings: ClientWebSettings;
  turnstileConfigured: boolean;
  slug: string;
  onSave: (values: ClientWebSettings) => Promise<ClientWebSettings>;
}) {
  const { t } = useTranslation();
  const form = useForm<ClientWebSettings>({ defaultValues: settings });
  const current = useWatch({ control: form.control, defaultValue: settings });
  const save = useMutation({ mutationFn: onSave, onSuccess: (values) => form.reset(values) });
  useEffect(() => { form.reset(settings); }, [form, settings]);
  useUnsavedChangesPrompt({ current, saved: settings, disabled: save.isPending });
  return (
    <form className="grid gap-8" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
        <div className="grid min-w-0 gap-1">
          <Label htmlFor="web-access-enabled">{t("clientsWebAccessEnabled")}</Label>
          {current.webAccessEnabled && (
            <p className="break-all text-sm text-muted-foreground">
              {t("webChatPageLink")}：{" "}
              <a className="text-primary underline underline-offset-4" href={`/chat/${slug}`} target="_blank" rel="noreferrer">{window.location.origin}/chat/{slug}</a>
            </p>
          )}
        </div>
        <Controller control={form.control} name="webAccessEnabled" render={({ field }) => (
          <Switch id="web-access-enabled" checked={field.value} onCheckedChange={field.onChange} disabled={save.isPending} />
        )} />
      </div>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
        <div className="grid gap-1">
          <Label htmlFor="web-turnstile-enabled">{t("webBotCheckEnabled")}</Label>
          <p className="text-sm text-muted-foreground">{t(turnstileConfigured ? "webBotCheckDescription" : "webBotCheckNotConfigured")}</p>
        </div>
        <Controller control={form.control} name="turnstileEnabled" render={({ field }) => (
          <Switch id="web-turnstile-enabled" checked={field.value} onCheckedChange={field.onChange} disabled={save.isPending || (!turnstileConfigured && !field.value)} />
        )} />
      </div>
      <fieldset className="grid gap-3" disabled={save.isPending}>
        <legend className="mb-3 text-sm font-medium">{t("webLoginSettings")}</legend>
        {(["none", "google"] as const).map((method) => (
          <label key={method} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-4 has-checked:border-primary">
            <input type="radio" value={method} {...form.register("loginMethod")} className="size-4 accent-primary" />
            <span className="grid gap-1">
              <span className="text-sm font-medium">{t(method === "none" ? "webLoginNone" : "webLoginGoogle")}</span>
              <span className="text-sm text-muted-foreground">{t(method === "none" ? "webLoginNoneDescription" : "webLoginGoogleDescription")}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex justify-end border-t border-border pt-8">
        <Button type="submit" disabled={save.isPending}>{t("saveSettings")}</Button>
      </div>
    </form>
  );
}
