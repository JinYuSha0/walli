import {
  IconBrandFlutter,
  IconBrandReactNative,
  IconBrandTelegram,
  IconWorldWww,
  type TablerIcon,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  getClientConfig,
  resetClientSettings,
  updateClientAuthSettings,
  updateClientBasicSettings,
  updateClientCorsSettings,
  updateClientDialogSettings,
  updateClientUsageLimit,
  updateTelegramSettings,
  type ClientAuthSettings,
  type ClientBasicSettings,
  type ClientBasicSettingsPatch,
  type ClientConfigResponse,
  type ClientCorsSettings,
  type ClientDialogSettings,
  type ClientPlatform,
  type ClientUsageLimit,
} from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextEditor } from "@/components/ui/text_editor";
import { CLIENT_PLATFORMS } from "../../shared/client";
import { AuthSettingsTab } from "./settings/components/auth-settings-tab";
import { CorsSettingsTab } from "./settings/components/cors-settings-tab";
import { DialogSettingsTab } from "./settings/components/dialog-settings-tab";
import { RouteLoading } from "./route-loading";

const platformMetaMap: Record<
  ClientPlatform,
  {
    icon: TablerIcon;
    labelKey: string;
  }
> = {
  web: {
    icon: IconWorldWww,
    labelKey: "clientPlatform.web",
  },
  "react-native": {
    icon: IconBrandReactNative,
    labelKey: "clientPlatform.reactNative",
  },
  flutter: {
    icon: IconBrandFlutter,
    labelKey: "clientPlatform.flutter",
  },
  telegram: {
    icon: IconBrandTelegram,
    labelKey: "clientPlatform.telegram",
  },
};

type ClientUsageSettingsForm = {
  usageLimit: {
    perRequestInputLimit: string;
    perRequestOutputLimit: string;
    perUserDailyInputLimit: string;
    perUserDailyOutputLimit: string;
  };
};

type TelegramSettingsForm = {
  botToken: string;
};

type ClientBasicSettingsForm = Pick<
  ClientBasicSettings,
  "enabled" | "additionalSystemPrompt"
>;

const clientTabs = ["basic", "dialog-settings", "auth", "cors", "usage"] as const;

type ClientTab = (typeof clientTabs)[number];

const getClientTabs = (platform: ClientPlatform): ClientTab[] =>
  platform === "telegram"
    ? ["basic", "auth", "usage"]
    : platform === "web"
      ? [...clientTabs]
      : ["basic", "dialog-settings", "auth", "usage"];

const isClientPlatform = (value: string): value is ClientPlatform =>
  CLIENT_PLATFORMS.includes(value as ClientPlatform);

const isClientTab = (value: string): value is ClientTab =>
  clientTabs.includes(value as ClientTab);

const toLimitValue = (value: number | undefined) => String(value ?? 0);

const toUsageFormValues = (usageLimit: ClientUsageLimit): ClientUsageSettingsForm => ({
  usageLimit: {
    perRequestInputLimit: toLimitValue(usageLimit.perRequestInputLimit),
    perRequestOutputLimit: toLimitValue(usageLimit.perRequestOutputLimit),
    perUserDailyInputLimit: toLimitValue(usageLimit.perUserDailyInputLimit),
    perUserDailyOutputLimit: toLimitValue(usageLimit.perUserDailyOutputLimit),
  },
});

const parseLimit = (value: string) => {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? Math.max(0, Math.trunc(parsedValue)) : 0;
};

const createTelegramWebhookCurl = (clientId: string, botToken: string) => {
  const origin = typeof window === "undefined" ? "https://your-domain.com" : window.location.origin;
  const webhookUrl = `${origin}/api/telegram/webhook`;
  const token = botToken.trim() || "<BOT_TOKEN>";

  return [
    `curl -X POST "https://api.telegram.org/bot${token}/setWebhook" \\`,
    '  -H "Content-Type: application/json" \\',
    `  -d '{"url":"${webhookUrl}","secret_token":"${clientId}"}'`,
  ].join("\n");
};

function ResetClientSettingsButton({
  disabled,
  onResetSettings,
}: {
  disabled?: boolean;
  onResetSettings: () => Promise<ClientConfigResponse>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const resetMutation = useMutation({
    mutationFn: onResetSettings,
    onSuccess: () => {
      setOpen(false);
      toast.success(t("clientsResetSettingsSuccess"));
    },
  });
  const pending = disabled || resetMutation.isPending;

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        <RefreshCcw />
        {t("clientsResetSettings")}
      </Button>
      {open ? (
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
              <h2 className="text-lg font-semibold">{t("clientsResetSettingsTitle")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("clientsResetSettingsConfirmDescription")}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                {t("clientsResetSettingsCancel")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={() => resetMutation.mutate()}
              >
                <RefreshCcw />
                {t("clientsResetSettingsConfirm")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ClientBasicSettingsTab({
  platform,
  basicSettings,
  clientId,
  disabled,
  showSaveButton = true,
  onDraftChange,
  onSaveBasicSettings,
  onResetSettings,
}: {
  platform: ClientPlatform;
  basicSettings: ClientBasicSettings;
  clientId: string;
  disabled?: boolean;
  showSaveButton?: boolean;
  onDraftChange?: (values: ClientBasicSettingsForm) => void;
  onSaveBasicSettings: (values: ClientBasicSettingsPatch) => Promise<ClientBasicSettings>;
  onResetSettings: () => Promise<ClientConfigResponse>;
}) {
  const { t } = useTranslation();
  const form = useForm<ClientBasicSettingsForm>({
    defaultValues: {
      enabled: basicSettings.enabled,
      additionalSystemPrompt: basicSettings.additionalSystemPrompt,
    },
  });
  const saveMutation = useMutation({
    mutationFn: onSaveBasicSettings,
    onSuccess: (values) => {
      form.reset({
        enabled: values.enabled,
        additionalSystemPrompt: values.additionalSystemPrompt,
      });
      toast.success(t("clientsBasicSettingsSaveSuccess"));
    },
  });
  const pending = disabled || saveMutation.isPending;
  const watchedBasicSettings = useWatch({
    control: form.control,
  });

  useEffect(() => {
    form.reset({
      enabled: basicSettings.enabled,
      additionalSystemPrompt: basicSettings.additionalSystemPrompt,
    });
  }, [basicSettings.additionalSystemPrompt, basicSettings.enabled, form]);

  useEffect(() => {
    onDraftChange?.({
      enabled: watchedBasicSettings.enabled ?? basicSettings.enabled,
      additionalSystemPrompt:
        watchedBasicSettings.additionalSystemPrompt ??
        basicSettings.additionalSystemPrompt,
    });
  }, [
    basicSettings.additionalSystemPrompt,
    basicSettings.enabled,
    onDraftChange,
    watchedBasicSettings.additionalSystemPrompt,
    watchedBasicSettings.enabled,
  ]);

  const onSubmit = (values: ClientBasicSettingsForm) => {
    saveMutation.mutate(values);
  };
  const submitBasicSettings = form.handleSubmit(onSubmit);

  return (
    <section className="grid gap-8">
      <div className="grid gap-4">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
          <div className="grid gap-1">
            <Label htmlFor={`client-enabled-${platform}`}>
              {t("clientsBasicSettingsEnabled")}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t("clientsBasicSettingsEnabledDescription")}
            </p>
          </div>
          <Controller
            control={form.control}
            name="enabled"
            render={({ field }) => (
              <Switch
                id={`client-enabled-${platform}`}
                checked={field.value}
                disabled={pending}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>

        <div className="grid gap-1">
          <h2 className="text-sm font-medium">{t("clientsBasicSettingsTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("clientsBasicSettingsDescription")}
          </p>
        </div>
        <Label className="sr-only" htmlFor={`client-id-${platform}`}>
          {t("clientsClientId")}
        </Label>
        <Input id={`client-id-${platform}`} readOnly value={clientId} />
      </div>

      <section className="grid gap-3 border-t border-border pt-8">
        <div className="grid gap-1">
          <Label htmlFor={`client-additional-system-prompt-${platform}`}>
            {t("clientsAdditionalSystemPromptTitle")}
          </Label>
          <p className="text-sm text-muted-foreground">
            {t("clientsAdditionalSystemPromptDescription")}
          </p>
        </div>
        <Controller
          control={form.control}
          name="additionalSystemPrompt"
          render={({ field, fieldState }) => (
            <div className="grid gap-2">
              <TextEditor
                id={`client-additional-system-prompt-${platform}`}
                aria-invalid={fieldState.invalid}
                disabled={pending}
                placeholder={t("clientsAdditionalSystemPromptPlaceholder")}
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

      {showSaveButton ? (
        <div className="flex justify-end gap-2 border-t border-border pt-8">
          <ResetClientSettingsButton
            disabled={pending}
            onResetSettings={onResetSettings}
          />
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              void submitBasicSettings();
            }}
          >
            {t("clientsBasicSettingsSave")}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function TelegramBasicSettingsTab({
  config,
  onSave,
  onSaveBasicSettings,
  onResetSettings,
}: {
  config: Extract<ClientConfigResponse, { platform: "telegram" }>;
  onSave: (values: TelegramSettingsForm) => Promise<ClientConfigResponse>;
  onSaveBasicSettings: (values: ClientBasicSettingsPatch) => Promise<ClientBasicSettings>;
  onResetSettings: () => Promise<ClientConfigResponse>;
}) {
  const { t } = useTranslation();
  const basicSettingsDraftRef = useRef<ClientBasicSettingsForm>({
    enabled: config.basicSettings.enabled,
    additionalSystemPrompt: config.basicSettings.additionalSystemPrompt,
  });
  const handleBasicSettingsDraftChange = useCallback((values: ClientBasicSettingsForm) => {
    basicSettingsDraftRef.current = values;
  }, []);
  const form = useForm<TelegramSettingsForm>({
    defaultValues: {
      botToken: config.telegramSettings.botTokenMask,
    },
  });
  const saveMutation = useMutation({
    mutationFn: async (values: TelegramSettingsForm) => {
      const basicSettings = await onSaveBasicSettings(basicSettingsDraftRef.current);

      const botToken = values.botToken.trim();

      if (!botToken || botToken === config.telegramSettings.botTokenMask) {
        return {
          ...config,
          basicSettings,
        };
      }

      const updatedConfig = await onSave({
        botToken,
      });

      return {
        ...updatedConfig,
        basicSettings,
      };
    },
    onSuccess: (values) => {
      const botToken =
        values.platform === "telegram" ? values.telegramSettings.botTokenMask : "";

      form.reset({
        botToken,
      });
      toast.success(t("clientsBasicSettingsSaveSuccess"));
    },
  });
  const watchedBotToken = useWatch({
    control: form.control,
    name: "botToken",
  }) ?? "";
  const curl = createTelegramWebhookCurl(config.clientId, watchedBotToken);

  useEffect(() => {
    form.reset({
      botToken: config.telegramSettings.botTokenMask,
    });
  }, [config.telegramSettings.botTokenMask, form]);

  return (
    <form className="grid gap-8" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
      <ClientBasicSettingsTab
        platform="telegram"
        basicSettings={config.basicSettings}
        clientId={config.clientId}
        disabled={saveMutation.isPending}
        showSaveButton={false}
        onDraftChange={handleBasicSettingsDraftChange}
        onSaveBasicSettings={onSaveBasicSettings}
        onResetSettings={onResetSettings}
      />

      <section className="grid gap-4 border-t border-border pt-8">
        <div className="grid gap-1">
          <h2 className="text-sm font-medium">{t("clientsTelegramBotTokenTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("clientsTelegramBotTokenDescription")}
          </p>
        </div>
        <Controller
          control={form.control}
          name="botToken"
          render={({ field }) => (
            <Input
              id="telegram-bot-token"
              type="text"
              autoComplete="off"
              disabled={saveMutation.isPending}
              placeholder={config.telegramSettings.botTokenMask || t("clientsTelegramBotTokenPlaceholder")}
              {...field}
            />
          )}
        />
      </section>

      <section className="grid gap-4 border-t border-border pt-8">
        <div className="grid gap-1">
          <h2 className="text-sm font-medium">{t("clientsTelegramWebhookCurlTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("clientsTelegramWebhookCurlDescription")}
          </p>
        </div>
        <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 text-sm">
          <code>{curl}</code>
        </pre>
      </section>

      <div className="flex justify-end gap-2 border-t border-border pt-8">
        <ResetClientSettingsButton
          disabled={saveMutation.isPending}
          onResetSettings={onResetSettings}
        />
        <Button type="submit" disabled={saveMutation.isPending}>
          {t("clientsBasicSettingsSave")}
        </Button>
      </div>
    </form>
  );
}

function ClientUsageSettingsTab({
  platform,
  usageLimit,
  onSave,
}: {
  platform: ClientPlatform;
  usageLimit: ClientUsageLimit;
  onSave: (values: ClientUsageLimit) => Promise<ClientUsageLimit>;
}) {
  const { t } = useTranslation();
  const form = useForm<ClientUsageSettingsForm>({
    defaultValues: toUsageFormValues(usageLimit),
  });
  const saveMutation = useMutation({
    mutationFn: onSave,
    onSuccess: (values) => {
      form.reset(toUsageFormValues(values));
      toast.success(t("usageSettingsSaveSuccess"));
    },
  });

  useEffect(() => {
    form.reset(toUsageFormValues(usageLimit));
  }, [form, usageLimit]);

  const onSubmit = (values: ClientUsageSettingsForm) => {
    saveMutation.mutate({
      perRequestInputLimit: parseLimit(values.usageLimit.perRequestInputLimit),
      perRequestOutputLimit: parseLimit(values.usageLimit.perRequestOutputLimit),
      perUserDailyInputLimit: parseLimit(values.usageLimit.perUserDailyInputLimit),
      perUserDailyOutputLimit: parseLimit(values.usageLimit.perUserDailyOutputLimit),
    });
  };

  return (
    <form className="grid gap-8" onSubmit={form.handleSubmit(onSubmit)}>
      <section className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="text-sm font-medium">{t("usageSettingsTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("clientUsageSettingsDescription", {
              platform: t(platformMetaMap[platform].labelKey),
            })}
          </p>
        </div>

        <div className="grid gap-4 rounded-lg border border-border p-4">
          <div className="grid gap-4 lg:grid-cols-4">
            <div className="grid gap-2">
              <Label htmlFor={`client-usage-single-input-${platform}`}>
                {t("usageSettingsPerRequestInputLimit")}
              </Label>
              <Controller
                control={form.control}
                name="usageLimit.perRequestInputLimit"
                render={({ field }) => (
                  <Input
                    id={`client-usage-single-input-${platform}`}
                    type="number"
                    min={0}
                    step={1}
                    disabled={saveMutation.isPending}
                    {...field}
                  />
                )}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`client-usage-single-output-${platform}`}>
                {t("usageSettingsPerRequestOutputLimit")}
              </Label>
              <Controller
                control={form.control}
                name="usageLimit.perRequestOutputLimit"
                render={({ field }) => (
                  <Input
                    id={`client-usage-single-output-${platform}`}
                    type="number"
                    min={0}
                    step={1}
                    disabled={saveMutation.isPending}
                    {...field}
                  />
                )}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`client-usage-daily-input-${platform}`}>
                {t("usageSettingsDailyInputLimit")}
              </Label>
              <Controller
                control={form.control}
                name="usageLimit.perUserDailyInputLimit"
                render={({ field }) => (
                  <Input
                    id={`client-usage-daily-input-${platform}`}
                    type="number"
                    min={0}
                    step={1}
                    disabled={saveMutation.isPending}
                    {...field}
                  />
                )}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`client-usage-daily-output-${platform}`}>
                {t("usageSettingsDailyOutputLimit")}
              </Label>
              <Controller
                control={form.control}
                name="usageLimit.perUserDailyOutputLimit"
                render={({ field }) => (
                  <Input
                    id={`client-usage-daily-output-${platform}`}
                    type="number"
                    min={0}
                    step={1}
                    disabled={saveMutation.isPending}
                    {...field}
                  />
                )}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-2 border-t border-border pt-8">
        <Button type="submit" disabled={saveMutation.isPending}>
          {t("usageSettingsSave")}
        </Button>
      </div>
    </form>
  );
}

export function ClientsRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [, , currentPlatform = "", currentTab = ""] =
    location.pathname.split("/");
  const platform = isClientPlatform(currentPlatform) ? currentPlatform : "telegram";
  const availableTabs = getClientTabs(platform);
  const activeTab = isClientTab(currentTab) && availableTabs.includes(currentTab) ? currentTab : "basic";
  const clientConfigQuery = useQuery({
    queryKey: ["client-config", platform],
    queryFn: () => getClientConfig(platform),
  });

  useEffect(() => {
    if (currentTab && activeTab !== currentTab) {
      void navigate({
        to: "/clients/$platform/$tab",
        params: {
          platform,
          tab: activeTab,
        },
        replace: true,
      });
    }
  }, [activeTab, currentTab, navigate, platform]);

  return (
    <div className="flex justify-center p-4 lg:p-6">
      <Card className="w-full max-w-5xl">
        <CardHeader>
          <CardTitle>{t("clientsTitle")}</CardTitle>
          <CardDescription>{t("clientsDescription")}</CardDescription>
          <p className="text-sm text-muted-foreground">
            {t("clientsKvDelayNote")}
          </p>
        </CardHeader>
        <CardContent>
          <Tabs
            value={platform}
            onValueChange={(value) => {
              if (!isClientPlatform(value)) {
                return;
              }

              void navigate({
                to: "/clients/$platform/$tab",
                params: {
                  platform: value,
                  tab: activeTab,
                },
              });
            }}
          >
            <TabsList className="h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0 sm:w-fit">
              {CLIENT_PLATFORMS.map((currentPlatform) => {
                const PlatformIcon = platformMetaMap[currentPlatform].icon;

                return (
                  <TabsTrigger
                    key={currentPlatform}
                    value={currentPlatform}
                    className="h-11 gap-2 rounded-lg border border-border bg-background px-4 text-muted-foreground shadow-sm data-[state=active]:border-primary/50 data-[state=active]:bg-primary/10 data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                  >
                    <PlatformIcon className="size-4 shrink-0" />
                    <span>{t(platformMetaMap[currentPlatform].labelKey)}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {CLIENT_PLATFORMS.map((tabPlatform) => (
              <TabsContent key={tabPlatform} value={tabPlatform}>
                {clientConfigQuery.isPending ? (
                  <RouteLoading />
                ) : clientConfigQuery.data ? (
                  <Tabs
                    value={activeTab}
                    onValueChange={(value) => {
                      if (!isClientTab(value) || !availableTabs.includes(value)) {
                        return;
                      }

                      void navigate({
                        to: "/clients/$platform/$tab",
                        params: {
                          platform,
                          tab: value,
                        },
                      });
                    }}
                  >
                    <TabsList className="w-full sm:w-fit">
                      <TabsTrigger value="basic">
                        {t("clientsBasicSettingsTab")}
                      </TabsTrigger>
                      {availableTabs.includes("dialog-settings") && (
                        <TabsTrigger value="dialog-settings">
                          {t("clientsDialogSettingsTab")}
                        </TabsTrigger>
                      )}
                      <TabsTrigger value="auth">
                        {t("authSettingsTab")}
                      </TabsTrigger>
                      {availableTabs.includes("cors") && (
                        <TabsTrigger value="cors">
                          {t("corsSettingsTab")}
                        </TabsTrigger>
                      )}
                      <TabsTrigger value="usage">
                        {t("usageSettingsTab")}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="basic">
                      {clientConfigQuery.data.platform === "telegram" ? (
                        <TelegramBasicSettingsTab
                          config={clientConfigQuery.data}
                          onSave={async (values: TelegramSettingsForm) => {
                            const updatedClientConfig = await updateTelegramSettings(values);
                            const cachedClientConfig = queryClient.getQueryData<ClientConfigResponse>(
                              ["client-config", tabPlatform],
                            );
                            const mergedClientConfig =
                              updatedClientConfig.platform === "telegram" &&
                              cachedClientConfig?.platform === "telegram"
                                ? {
                                    ...updatedClientConfig,
                                    basicSettings: cachedClientConfig.basicSettings,
                                  }
                                : updatedClientConfig;

                            queryClient.setQueryData(
                              ["client-config", tabPlatform],
                              mergedClientConfig,
                            );

                            return mergedClientConfig;
                          }}
                          onSaveBasicSettings={async (values: ClientBasicSettingsPatch) => {
                            const updatedClientConfig = await updateClientBasicSettings(
                              clientConfigQuery.data.platform,
                              values,
                            );

                            queryClient.setQueryData(
                              ["client-config", tabPlatform],
                              updatedClientConfig,
                            );

                            return updatedClientConfig.basicSettings;
                          }}
                          onResetSettings={async () => {
                            const updatedClientConfig = await resetClientSettings(
                              clientConfigQuery.data.platform,
                            );

                            queryClient.setQueryData(
                              ["client-config", tabPlatform],
                              updatedClientConfig,
                            );

                            return updatedClientConfig;
                          }}
                        />
                      ) : (
                        <ClientBasicSettingsTab
                          platform={tabPlatform}
                          basicSettings={clientConfigQuery.data.basicSettings}
                          clientId={clientConfigQuery.data.clientId}
                          onSaveBasicSettings={async (values: ClientBasicSettingsPatch) => {
                            const updatedClientConfig = await updateClientBasicSettings(
                              clientConfigQuery.data.platform,
                              values,
                            );

                            queryClient.setQueryData(
                              ["client-config", tabPlatform],
                              updatedClientConfig,
                            );

                            return updatedClientConfig.basicSettings;
                          }}
                          onResetSettings={async () => {
                            const updatedClientConfig = await resetClientSettings(
                              clientConfigQuery.data.platform,
                            );

                            queryClient.setQueryData(
                              ["client-config", tabPlatform],
                              updatedClientConfig,
                            );

                            return updatedClientConfig;
                          }}
                        />
                      )}
                    </TabsContent>

                    {availableTabs.includes("dialog-settings") && (
                      <TabsContent value="dialog-settings">
                        {"dialogSettings" in clientConfigQuery.data && (
                          <DialogSettingsTab
                            settings={clientConfigQuery.data.dialogSettings}
                            onSave={async (values: ClientDialogSettings) => {
                              const updatedClientConfig =
                                await updateClientDialogSettings(
                                  tabPlatform,
                                  values,
                                );

                              queryClient.setQueryData(
                                ["client-config", tabPlatform],
                                updatedClientConfig,
                              );

                              if (!("dialogSettings" in updatedClientConfig)) {
                                throw new Error("Dialog settings are unavailable for this client");
                              }

                              return updatedClientConfig.dialogSettings;
                            }}
                          />
                        )}
                      </TabsContent>
                    )}

                    <TabsContent value="auth">
                      <AuthSettingsTab
                        settings={clientConfigQuery.data.authSettings}
                        onSave={async (values: ClientAuthSettings) => {
                          const updatedClientConfig = await updateClientAuthSettings(
                            tabPlatform,
                            values,
                          );

                          queryClient.setQueryData(
                            ["client-config", tabPlatform],
                            updatedClientConfig,
                          );

                          return updatedClientConfig.authSettings;
                        }}
                      />
                    </TabsContent>

                    {availableTabs.includes("cors") && (
                      <TabsContent value="cors">
                        {"corsSettings" in clientConfigQuery.data && (
                          <CorsSettingsTab
                            settings={clientConfigQuery.data.corsSettings}
                            onSave={async (values: ClientCorsSettings) => {
                              const updatedClientConfig =
                                await updateClientCorsSettings(values);

                              queryClient.setQueryData(
                                ["client-config", tabPlatform],
                                updatedClientConfig,
                              );

                              if (!("corsSettings" in updatedClientConfig)) {
                                throw new Error("CORS settings are unavailable for this client");
                              }

                              return updatedClientConfig.corsSettings;
                            }}
                          />
                        )}
                      </TabsContent>
                    )}

                    <TabsContent value="usage">
                      <ClientUsageSettingsTab
                        platform={tabPlatform}
                        usageLimit={clientConfigQuery.data.usageLimit}
                        onSave={async (values: ClientUsageLimit) => {
                          const updatedClientConfig = await updateClientUsageLimit(
                            tabPlatform,
                            values,
                          );

                          queryClient.setQueryData(
                            ["client-config", tabPlatform],
                            updatedClientConfig,
                          );

                          return updatedClientConfig.usageLimit;
                        }}
                      />
                    </TabsContent>
                  </Tabs>
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    {t("clientsLoadFailed")}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
