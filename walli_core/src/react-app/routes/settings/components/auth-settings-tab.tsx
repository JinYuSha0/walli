import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { ClientAuthSettings } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUnsavedChangesPrompt } from "@/hooks/use-unsaved-changes-prompt";

type AuthSettingsForm = ClientAuthSettings;

type AuthSettingsTabProps = {
  settings: ClientAuthSettings;
  onSave: (values: ClientAuthSettings) => Promise<ClientAuthSettings>;
};

const createNodeExample = (url: string) => {
  const endpointUrl = url.trim() || "https://api.example.com/auth/verify";

  return `const response = await fetch(${JSON.stringify(endpointUrl)}, {
  method: "POST",
  headers: {
    "content-type": "application/json",
  },
  body: JSON.stringify({
    appId,
    userId,
    token,
  }),
});

if (response.status === 200) {
  return Response.json({
    userInfo: {
      id: userId,
      name: "Demo User",
      plan: "pro",
    },
  });
} else {
  return new Response("Forbidden", {
    status: 403,
  });
}`;
};

const isValidHttpUrl = (value: string) => {
  try {
    const url = new URL(value.trim());

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export function AuthSettingsTab({ settings, onSave }: AuthSettingsTabProps) {
  const { t } = useTranslation();
  const savedSettings: AuthSettingsForm = {
    authEnabled: settings.authEnabled,
    authEndpointUrl: settings.authEndpointUrl,
  };
  const form = useForm<AuthSettingsForm>({
    defaultValues: savedSettings,
  });
  const authEnabled = form.watch("authEnabled");
  const authEndpointUrl = form.watch("authEndpointUrl");
  const watchedSettings = useWatch({
    control: form.control,
    defaultValue: savedSettings,
  }) as AuthSettingsForm;
  const saveMutation = useMutation({
    mutationFn: onSave,
    onSuccess: (values) => {
      form.reset({
        authEnabled: values.authEnabled,
        authEndpointUrl: values.authEndpointUrl,
      });
      toast.success(t("authSettingsSaveSuccess"));
    },
  });

  useEffect(() => {
    form.reset({
      authEnabled: settings.authEnabled,
      authEndpointUrl: settings.authEndpointUrl,
    });
  }, [form, settings.authEnabled, settings.authEndpointUrl]);

  const onSubmit = (values: AuthSettingsForm) => {
    saveMutation.mutate({
      authEnabled: values.authEnabled,
      authEndpointUrl: values.authEndpointUrl.trim(),
    });
  };
  useUnsavedChangesPrompt({
    current: watchedSettings,
    saved: settings,
    disabled: saveMutation.isPending,
  });

  return (
    <form className="grid gap-8" onSubmit={form.handleSubmit(onSubmit)}>
      <section className="grid gap-4">
        <Controller
          control={form.control}
          name="authEnabled"
          render={({ field }) => (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
              <div className="grid gap-1">
                <Label htmlFor="auth-enabled">
                  {t("authSettingsEnabled")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("authSettingsEnabledDescription")}
                </p>
              </div>
              <Switch
                id="auth-enabled"
                checked={field.value}
                disabled={saveMutation.isPending}
                onCheckedChange={field.onChange}
              />
            </div>
          )}
        />

        <Controller
          control={form.control}
          name="authEndpointUrl"
          rules={{
            validate: (value) => {
              const trimmedValue = value.trim();

              if (!authEnabled && trimmedValue.length === 0) {
                return true;
              }

              if (authEnabled && trimmedValue.length === 0) {
                return t("authSettingsEndpointUrlRequired");
              }

              return (
                isValidHttpUrl(trimmedValue) ||
                t("authSettingsEndpointUrlInvalid")
              );
            },
          }}
          render={({ field, fieldState }) => (
            <div className="grid gap-2">
              <Label htmlFor="auth-endpoint-url">
                {t("authSettingsEndpointUrl")}
              </Label>
              <Input
                id="auth-endpoint-url"
                aria-invalid={fieldState.invalid}
                disabled={saveMutation.isPending}
                placeholder={t("authSettingsEndpointUrlPlaceholder")}
                {...field}
              />
              <p className="text-sm text-muted-foreground">
                {t("authSettingsEndpointUrlDescription")}
              </p>
              {fieldState.error?.message && (
                <p className="text-sm text-destructive">
                  {fieldState.error.message}
                </p>
              )}
            </div>
          )}
        />
      </section>

      <section className="grid gap-3 border-t border-border pt-8">
        <div className="grid gap-1">
          <h2 className="text-sm font-medium">
            {t("authSettingsNodeExampleTitle")}
          </h2>
        </div>
        <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 text-sm leading-6">
          <code>{createNodeExample(authEndpointUrl)}</code>
        </pre>
      </section>

      <div className="flex justify-end gap-2 border-t border-border pt-8">
        <Button type="submit" disabled={saveMutation.isPending}>
          {t("authSettingsSave")}
        </Button>
      </div>
    </form>
  );
}
