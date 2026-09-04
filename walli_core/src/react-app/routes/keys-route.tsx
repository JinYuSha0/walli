import {
  IconBrandFlutter,
  IconBrandReactNative,
  IconBrandTelegram,
  IconWorldWww,
  type TablerIcon,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  createTelegramWhitelistEntry,
  createClient,
  deleteClient,
  deleteTelegramWhitelistEntry,
  getClientConfig,
  getClients,
  getTelegramWhitelistEntries,
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
  type ClientCreate,
  type ClientCorsSettings,
  type ClientDialogSettings,
  type ClientPlatform,
  type ClientUsageLimit,
  type TelegramWhitelistEntry,
  type TelegramWhitelistType,
} from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextEditor } from "@/components/ui/text_editor";
import { useUnsavedChangesPrompt } from "@/hooks/use-unsaved-changes-prompt";
import {
  CLIENT_PLATFORMS,
  TELEGRAM_WHITELIST_ID_MAX_LENGTH,
  TELEGRAM_WHITELIST_ID_PATTERN,
  TELEGRAM_WHITELIST_REMARK_MAX_LENGTH,
} from "@shared/client";
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
    historyMessageLimit: string;
    autoDeletePeriod: ClientUsageLimit["autoDeletePeriod"];
  };
};

type TelegramSettingsForm = {
  botToken: string;
};

type TelegramAuthSettingsForm = {
  accessPolicy: Extract<ClientConfigResponse, { platform: "telegram" }>["telegramSettings"]["accessPolicy"];
};

type TelegramWhitelistCreateForm = {
  type: TelegramWhitelistType;
  id: string;
  remark: string;
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

const isClientTab = (value: string): value is ClientTab =>
  clientTabs.includes(value as ClientTab);

const fuzzyMatch = (value: string, query: string) => {
  const normalizedValue = value.toLocaleLowerCase();
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return true;
  if (normalizedValue.includes(normalizedQuery)) return true;

  let queryIndex = 0;
  for (const character of normalizedValue) {
    if (character === normalizedQuery[queryIndex]) queryIndex += 1;
    if (queryIndex === normalizedQuery.length) return true;
  }
  return false;
};

const toLimitValue = (value: number | undefined) => String(value ?? 0);

const toUsageFormValues = (usageLimit: ClientUsageLimit): ClientUsageSettingsForm => ({
  usageLimit: {
    perRequestInputLimit: toLimitValue(usageLimit.perRequestInputLimit),
    perRequestOutputLimit: toLimitValue(usageLimit.perRequestOutputLimit),
    perUserDailyInputLimit: toLimitValue(usageLimit.perUserDailyInputLimit),
    perUserDailyOutputLimit: toLimitValue(usageLimit.perUserDailyOutputLimit),
    historyMessageLimit: toLimitValue(usageLimit.historyMessageLimit),
    autoDeletePeriod: usageLimit.autoDeletePeriod,
  },
});

const parseLimit = (value: string) => {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? Math.max(0, Math.trunc(parsedValue)) : 0;
};

const createTelegramWebhookCurl = (clientId: string, slug: string, botToken: string) => {
  const origin = typeof window === "undefined" ? "https://your-domain.com" : window.location.origin;
  const webhookUrl = `${origin}/api/telegram/webhook/${slug}`;
  const token = botToken.trim() || "<BOT_TOKEN>";

  return [
    `curl -X POST "https://api.telegram.org/bot${token}/setWebhook" \\`,
    '  -H "Content-Type: application/json" \\',
    `  -d '{"url":"${webhookUrl}","secret_token":"${clientId}"}'`,
  ].join("\n");
};

function DeleteClientButton({
  disabled,
  onDelete,
}: {
  disabled?: boolean;
  onDelete: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const deleteMutation = useMutation({
    mutationFn: onDelete,
    onSuccess: () => {
      setOpen(false);
      toast.success(t("clientsDeleteSuccess"));
    },
  });
  const pending = disabled || deleteMutation.isPending;

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        <Trash2 />
        {t("clientsDelete")}
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
              <h2 className="text-lg font-semibold">{t("clientsDeleteTitle")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("clientsDeleteConfirmDescription")}
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
                onClick={() => deleteMutation.mutate()}
              >
                <Trash2 />
                {t("clientsDeleteConfirm")}
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
  skipUnsavedPrompt = false,
  onDraftChange,
  onSaveBasicSettings,
  onDelete,
}: {
  platform: ClientPlatform;
  basicSettings: ClientBasicSettings;
  clientId: string;
  disabled?: boolean;
  showSaveButton?: boolean;
  skipUnsavedPrompt?: boolean;
  onDraftChange?: (values: ClientBasicSettingsForm) => void;
  onSaveBasicSettings: (values: ClientBasicSettingsPatch) => Promise<ClientBasicSettings>;
  onDelete: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const form = useForm<ClientBasicSettingsForm>({
    defaultValues: {
      enabled: basicSettings.enabled,
      additionalSystemPrompt: basicSettings.additionalSystemPrompt,
    },
  });
  const savedBasicSettings: ClientBasicSettingsForm = {
    enabled: basicSettings.enabled,
    additionalSystemPrompt: basicSettings.additionalSystemPrompt,
  };
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
    defaultValue: savedBasicSettings,
  }) as ClientBasicSettingsForm;
  const watchedEnabled = watchedBasicSettings.enabled;
  const watchedAdditionalSystemPrompt = watchedBasicSettings.additionalSystemPrompt;

  useEffect(() => {
    form.reset({
      enabled: basicSettings.enabled,
      additionalSystemPrompt: basicSettings.additionalSystemPrompt,
    });
  }, [basicSettings.additionalSystemPrompt, basicSettings.enabled, form]);

  useEffect(() => {
    onDraftChange?.({
      enabled: watchedEnabled,
      additionalSystemPrompt: watchedAdditionalSystemPrompt,
    });
  }, [
    onDraftChange,
    watchedAdditionalSystemPrompt,
    watchedEnabled,
  ]);

  const onSubmit = (values: ClientBasicSettingsForm) => {
    saveMutation.mutate(values);
  };
  const submitBasicSettings = form.handleSubmit(onSubmit);
  useUnsavedChangesPrompt({
    current: watchedBasicSettings,
    saved: savedBasicSettings,
    disabled: pending || skipUnsavedPrompt,
  });

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
          <DeleteClientButton
            disabled={pending}
            onDelete={onDelete}
          />
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              void submitBasicSettings();
            }}
          >
            {t("saveSettings")}
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
  onDelete,
}: {
  config: Extract<ClientConfigResponse, { platform: "telegram" }>;
  onSave: (values: TelegramSettingsForm) => Promise<ClientConfigResponse>;
  onSaveBasicSettings: (values: ClientBasicSettingsPatch) => Promise<ClientBasicSettings>;
  onDelete: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [basicSettingsDraft, setBasicSettingsDraft] = useState<ClientBasicSettingsForm>({
    enabled: config.basicSettings.enabled,
    additionalSystemPrompt: config.basicSettings.additionalSystemPrompt,
  });
  const basicSettingsDraftRef = useRef<ClientBasicSettingsForm>(basicSettingsDraft);
  const handleBasicSettingsDraftChange = useCallback((values: ClientBasicSettingsForm) => {
    setBasicSettingsDraft(values);
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
  const curl = createTelegramWebhookCurl(config.id, config.slug, watchedBotToken);

  useEffect(() => {
    form.reset({
      botToken: config.telegramSettings.botTokenMask,
    });
  }, [config.telegramSettings.botTokenMask, form]);
  useUnsavedChangesPrompt({
    current: {
      basicSettings: basicSettingsDraft,
      botToken: watchedBotToken,
    },
    saved: {
      basicSettings: {
        enabled: config.basicSettings.enabled,
        additionalSystemPrompt: config.basicSettings.additionalSystemPrompt,
      },
      botToken: config.telegramSettings.botTokenMask,
    },
    disabled: saveMutation.isPending,
  });

  return (
    <form className="grid gap-8" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
      <ClientBasicSettingsTab
        platform="telegram"
        basicSettings={config.basicSettings}
        clientId={config.id}
        disabled={saveMutation.isPending}
        showSaveButton={false}
        skipUnsavedPrompt
        onDraftChange={handleBasicSettingsDraftChange}
        onSaveBasicSettings={onSaveBasicSettings}
        onDelete={onDelete}
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
        <DeleteClientButton
          disabled={saveMutation.isPending}
          onDelete={onDelete}
        />
        <Button type="submit" disabled={saveMutation.isPending}>
          {t("saveSettings")}
        </Button>
      </div>
    </form>
  );
}

function TelegramAuthSettingsTab({
  settings,
  onSave,
}: {
  settings: Extract<ClientConfigResponse, { platform: "telegram" }>["telegramSettings"];
  onSave: (values: {
    accessPolicy: TelegramAuthSettingsForm["accessPolicy"];
  }) => Promise<Extract<ClientConfigResponse, { platform: "telegram" }>["telegramSettings"]>;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<TelegramWhitelistType | "all">("all");
  const [deleteTarget, setDeleteTarget] = useState<TelegramWhitelistEntry | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const pageSize = 10;
  const savedSettings = useMemo(
    () =>
      ({
        accessPolicy: settings.accessPolicy,
      }) satisfies TelegramAuthSettingsForm,
    [settings.accessPolicy],
  );
  const form = useForm<TelegramAuthSettingsForm>({
    defaultValues: savedSettings,
  });
  const createForm = useForm<TelegramWhitelistCreateForm>({
    defaultValues: {
      type: "private",
      id: "",
      remark: "",
    },
  });
  const watchedSettings = useWatch({
    control: form.control,
    defaultValue: savedSettings,
  }) as TelegramAuthSettingsForm;
  const saveMutation = useMutation({
    mutationFn: async (values: TelegramAuthSettingsForm) =>
      onSave({
        accessPolicy: values.accessPolicy,
      }),
    onSuccess: (values) => {
      form.reset({
        accessPolicy: values.accessPolicy,
      });
      toast.success(t("telegramAuthSettingsSaveSuccess"));
    },
  });
  const createMutation = useMutation({
    mutationFn: async (values: TelegramWhitelistCreateForm) =>
      createTelegramWhitelistEntry({
        type: values.type,
        id: values.id.trim(),
        remark: values.remark.trim(),
      }),
    onSuccess: async () => {
      createForm.reset({
        type: createForm.getValues("type"),
        id: "",
        remark: "",
      });
      setCreateDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["telegram-whitelist"] });
      toast.success(t("telegramWhitelistCreateSuccess"));
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteTelegramWhitelistEntry,
    onSuccess: async () => {
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["telegram-whitelist"] });
      toast.success(t("telegramWhitelistDeleteSuccess"));
    },
  });
  const showWhitelist = watchedSettings.accessPolicy === "whitelist";
  const whitelistQuery = useQuery({
    queryKey: ["telegram-whitelist", page, pageSize, typeFilter],
    queryFn: () =>
      getTelegramWhitelistEntries({
        page,
        pageSize,
        type: typeFilter === "all" ? undefined : typeFilter,
    }),
    enabled: showWhitelist,
  });
  const totalPages = Math.max(1, Math.ceil((whitelistQuery.data?.total ?? 0) / pageSize));

  useEffect(() => {
    form.reset(savedSettings);
  }, [form, savedSettings]);

  useUnsavedChangesPrompt({
    current: watchedSettings,
    saved: savedSettings,
    disabled: saveMutation.isPending,
  });

  return (
    <div className="grid gap-8">
      <form className="grid gap-4" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
        <div className="grid gap-1">
          <h2 className="text-sm font-medium">{t("telegramAuthSettingsTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("telegramAuthSettingsDescription")}
          </p>
        </div>
        <Controller
          control={form.control}
          name="accessPolicy"
          render={({ field }) => (
            <div className="grid gap-2">
              <Label htmlFor="telegram-access-policy">
                {t("telegramAuthSettingsPolicy")}
              </Label>
              <Select
                id="telegram-access-policy"
                disabled={saveMutation.isPending}
                {...field}
              >
                <option value="public">{t("telegramAuthSettingsPolicyPublic")}</option>
                <option value="whitelist">{t("telegramAuthSettingsPolicyWhitelist")}</option>
              </Select>
            </div>
          )}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={saveMutation.isPending}>
            {t("saveSettings")}
          </Button>
        </div>
      </form>

      {showWhitelist ? (
        <section className="grid gap-4 border-t border-border pt-8">
          <div className="grid gap-1">
            <h2 className="text-sm font-medium">{t("telegramAuthSettingsWhitelistTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("telegramAuthSettingsWhitelistDescription")}
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="w-full md:w-48">
              <Select
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value as TelegramWhitelistType | "all");
                  setPage(1);
                  setDeleteTarget(null);
                }}
              >
                <option value="all">{t("telegramWhitelistFilterAll")}</option>
                <option value="private">{t("telegramWhitelistTypePrivate")}</option>
                <option value="group">{t("telegramWhitelistTypeGroup")}</option>
              </Select>
            </div>
            <Dialog
              open={createDialogOpen}
              onOpenChange={(open) => {
                setCreateDialogOpen(open);
                if (!open) {
                  createForm.reset({
                    type: createForm.getValues("type"),
                    id: "",
                    remark: "",
                  });
                }
              }}
            >
              <DialogTrigger asChild>
                <Button type="button" className="w-fit">
                  {t("telegramWhitelistAdd")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("telegramWhitelistAdd")}</DialogTitle>
                  <DialogDescription>
                    {t("telegramAuthSettingsWhitelistDescription")}
                  </DialogDescription>
                </DialogHeader>
                <form
                  className="grid gap-4"
                  onSubmit={createForm.handleSubmit((values) => createMutation.mutate(values))}
                >
                  <Controller
                    control={createForm.control}
                    name="type"
                    render={({ field }) => (
                      <div className="grid gap-2">
                        <Label htmlFor="telegram-whitelist-type">
                          {t("telegramWhitelistType")}
                        </Label>
                        <Select
                          id="telegram-whitelist-type"
                          disabled={createMutation.isPending}
                          {...field}
                        >
                          <option value="private">{t("telegramWhitelistTypePrivate")}</option>
                          <option value="group">{t("telegramWhitelistTypeGroup")}</option>
                        </Select>
                      </div>
                    )}
                  />
                  <Controller
                    control={createForm.control}
                    name="id"
                    rules={{
                      validate: {
                        required: (value) =>
                          value.trim().length > 0 || t("telegramWhitelistIdRequired"),
                        maxLength: (value) =>
                          value.trim().length <= TELEGRAM_WHITELIST_ID_MAX_LENGTH ||
                          t("telegramWhitelistIdMaxLength", {
                            count: TELEGRAM_WHITELIST_ID_MAX_LENGTH,
                          }),
                        pattern: (value) =>
                          TELEGRAM_WHITELIST_ID_PATTERN.test(value.trim()) ||
                          t("telegramWhitelistIdPattern"),
                      },
                    }}
                    render={({ field, fieldState }) => (
                      <div className="grid gap-2">
                        <Label htmlFor="telegram-whitelist-id">
                          {t("telegramWhitelistId")}
                        </Label>
                        <Input
                          id="telegram-whitelist-id"
                          autoComplete="off"
                          disabled={createMutation.isPending}
                          maxLength={TELEGRAM_WHITELIST_ID_MAX_LENGTH}
                          placeholder={t("telegramWhitelistIdPlaceholder")}
                          aria-invalid={fieldState.invalid}
                          {...field}
                        />
                        {fieldState.error?.message ? (
                          <p className="text-xs text-destructive">{fieldState.error.message}</p>
                        ) : null}
                      </div>
                      )}
                    />
                  <Controller
                    control={createForm.control}
                    name="remark"
                    rules={{
                      validate: (value) =>
                        value.trim().length <= TELEGRAM_WHITELIST_REMARK_MAX_LENGTH ||
                        t("telegramWhitelistRemarkMaxLength", {
                          count: TELEGRAM_WHITELIST_REMARK_MAX_LENGTH,
                        }),
                    }}
                    render={({ field, fieldState }) => (
                      <div className="grid gap-2">
                        <Label htmlFor="telegram-whitelist-remark">
                          {t("telegramWhitelistRemark")}
                        </Label>
                        <Input
                          id="telegram-whitelist-remark"
                          autoComplete="off"
                          disabled={createMutation.isPending}
                          maxLength={TELEGRAM_WHITELIST_REMARK_MAX_LENGTH}
                          placeholder={t("telegramWhitelistRemarkPlaceholder")}
                          aria-invalid={fieldState.invalid}
                          {...field}
                        />
                        {fieldState.error?.message ? (
                          <p className="text-xs text-destructive">{fieldState.error.message}</p>
                        ) : null}
                      </div>
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={createMutation.isPending}
                      onClick={() => setCreateDialogOpen(false)}
                    >
                      {t("telegramWhitelistDeleteCancel")}
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {t("telegramWhitelistAdd")}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <div className="min-w-[680px]">
            <div className="grid grid-cols-[110px_1fr_1fr_160px] border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>{t("telegramWhitelistType")}</span>
              <span>{t("telegramWhitelistId")}</span>
              <span>{t("telegramWhitelistRemark")}</span>
              <span className="text-right">{t("telegramWhitelistActions")}</span>
            </div>
            {whitelistQuery.isLoading ? (
              <div className="px-3 py-6 text-sm text-muted-foreground">
                {t("telegramWhitelistLoading")}
              </div>
            ) : whitelistQuery.data?.items.length ? (
              whitelistQuery.data.items.map((entry) => {
                const isConfirming =
                  deleteTarget?.type === entry.type && deleteTarget.id === entry.id;

                return (
                  <div
                    key={`${entry.type}:${entry.id}`}
                    className="grid grid-cols-[110px_1fr_1fr_160px] items-center border-b border-border px-3 py-2 text-sm last:border-b-0"
                  >
                    <span>
                      {entry.type === "private"
                        ? t("telegramWhitelistTypePrivate")
                        : t("telegramWhitelistTypeGroup")}
                    </span>
                    <span className="min-w-0 truncate font-mono">{entry.id}</span>
                    <span className="min-w-0 truncate text-muted-foreground">
                      {entry.remark || t("clientsEmptyValue")}
                    </span>
                    <div className="flex justify-end gap-2">
                      {isConfirming ? (
                        <>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={deleteMutation.isPending}
                            onClick={() => deleteMutation.mutate(entry)}
                          >
                            {t("telegramWhitelistDeleteConfirm")}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={deleteMutation.isPending}
                            onClick={() => setDeleteTarget(null)}
                          >
                            {t("telegramWhitelistDeleteCancel")}
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteTarget(entry)}
                        >
                          {t("telegramWhitelistDelete")}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-6 text-sm text-muted-foreground">
                {t("telegramWhitelistEmpty")}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {t("telegramWhitelistTotal", { count: whitelistQuery.data?.total ?? 0 })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || whitelistQuery.isFetching}
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
            >
              {t("telegramWhitelistPrev")}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t("telegramWhitelistPage", { page, totalPages })}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || whitelistQuery.isFetching}
              onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
            >
              {t("telegramWhitelistNext")}
            </Button>
          </div>
        </div>
      </section>
      ) : null}
    </div>
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
  const savedSettings = toUsageFormValues(usageLimit);
  const form = useForm<ClientUsageSettingsForm>({
    defaultValues: savedSettings,
  });
  const watchedSettings = useWatch({
    control: form.control,
    defaultValue: savedSettings,
  }) as ClientUsageSettingsForm;
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
      historyMessageLimit: parseLimit(values.usageLimit.historyMessageLimit),
      autoDeletePeriod: values.usageLimit.autoDeletePeriod,
    });
  };
  useUnsavedChangesPrompt({
    current: watchedSettings,
    saved: savedSettings,
    disabled: saveMutation.isPending,
  });

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

      <section className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="text-sm font-medium">{t("usageSettingsLlmMessageTitle")}</h2>
        </div>

        <div className="grid gap-4 rounded-lg border border-border p-4">
          <div className="grid gap-2 lg:max-w-[calc(50%-0.5rem)]">
            <Label htmlFor={`client-usage-history-messages-${platform}`}>
              {t("usageSettingsLlmMessageLimit")}
            </Label>
            <Controller
              control={form.control}
              name="usageLimit.historyMessageLimit"
              render={({ field }) => (
                <Input
                  id={`client-usage-history-messages-${platform}`}
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
      </section>

      <section className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="text-sm font-medium">{t("usageSettingsConversationCleanupTitle")}</h2>
        </div>

        <div className="grid gap-4 rounded-lg border border-border p-4">
          <div className="grid gap-2 lg:max-w-[calc(50%-0.5rem)]">
            <Label htmlFor={`client-usage-auto-delete-${platform}`}>
              {t("usageSettingsConversationCleanupPeriod")}
            </Label>
            <Controller
              control={form.control}
              name="usageLimit.autoDeletePeriod"
              render={({ field }) => (
                <Select
                  id={`client-usage-auto-delete-${platform}`}
                  disabled={saveMutation.isPending}
                  {...field}
                >
                  <option value="never">{t("usageSettingsAutoDeletePeriod.never")}</option>
                  <option value="day">{t("usageSettingsAutoDeletePeriod.day")}</option>
                  <option value="week">{t("usageSettingsAutoDeletePeriod.week")}</option>
                  <option value="month">{t("usageSettingsAutoDeletePeriod.month")}</option>
                </Select>
              )}
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-2 border-t border-border pt-8">
        <Button type="submit" disabled={saveMutation.isPending}>
          {t("saveSettings")}
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
  const clientsQuery = useQuery({ queryKey: ["clients"], queryFn: getClients });
  const selectedClient = clientsQuery.data?.find(({ id }) => id === currentPlatform);
  const platform = selectedClient?.platform ?? "telegram";
  const availableTabs = getClientTabs(platform);
  const activeTab = isClientTab(currentTab) && availableTabs.includes(currentTab) ? currentTab : "basic";
  const clientConfigQuery = useQuery({
    queryKey: ["client-config", selectedClient?.id],
    queryFn: () => getClientConfig(selectedClient!.id),
    enabled: Boolean(selectedClient),
  });

  useEffect(() => {
    if (selectedClient && currentTab && activeTab !== currentTab) {
      void navigate({
        to: "/clients/$platform/$tab",
        params: {
          platform: selectedClient.id,
          tab: activeTab,
        },
        replace: true,
      });
    }
  }, [activeTab, currentTab, navigate, selectedClient]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createValues, setCreateValues] = useState<ClientCreate>({
    name: "",
    slug: "",
    platform: "web",
  });
  const createMutation = useMutation({
    mutationFn: createClient,
    onSuccess: async (config) => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.setQueryData(["client-config", config.id], config);
      setCreateOpen(false);
      setCreateValues({ name: "", slug: "", platform: "web" });
      void navigate({
        to: "/clients/$platform/$tab",
        params: { platform: config.id, tab: "basic" },
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("clientsCreateFailed"));
    },
  });
  const handleDeleteClient = async () => {
    if (!selectedClient) return;
    await deleteClient(selectedClient.id);
    queryClient.removeQueries({ queryKey: ["client-config", selectedClient.id] });
    await queryClient.invalidateQueries({ queryKey: ["clients"] });
    await navigate({ to: "/clients" });
  };
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const filteredClients = useMemo(
    () => (clientsQuery.data ?? []).filter((client) =>
      fuzzyMatch(`${client.name} ${client.slug} ${client.platform}`, searchQuery),
    ),
    [clientsQuery.data, searchQuery],
  );
  const selectClient = (clientId: string) => {
    setSearchOpen(false);
    setSearchQuery("");
    void navigate({
      to: "/clients/$platform/$tab",
      params: { platform: clientId, tab: "basic" },
    });
  };

  return (
    <div className="flex justify-center p-4 lg:p-6">
      <Card className="w-full max-w-5xl">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>{t("clientsTitle")}</CardTitle>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button type="button"><Plus />{t("clientsCreate")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("clientsCreate")}</DialogTitle>
                  <DialogDescription>{t("clientsCreateDescription")}</DialogDescription>
                </DialogHeader>
                <form
                  className="grid gap-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    createMutation.mutate(createValues);
                  }}
                >
                  <div className="grid gap-2">
                    <Label htmlFor="client-name">{t("clientsName")}</Label>
                    <Input
                      id="client-name"
                      required
                      value={createValues.name}
                      onChange={(event) => setCreateValues((value) => ({ ...value, name: event.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="client-slug">Slug</Label>
                    <Input
                      id="client-slug"
                      required
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                      value={createValues.slug}
                      onChange={(event) => setCreateValues((value) => ({ ...value, slug: event.target.value.toLowerCase() }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="client-type">{t("clientsType")}</Label>
                    <Select
                      id="client-type"
                      value={createValues.platform}
                      onChange={(event) => setCreateValues((value) => ({ ...value, platform: event.target.value as ClientPlatform }))}
                    >
                      {CLIENT_PLATFORMS.map((value) => (
                        <option key={value} value={value}>{t(platformMetaMap[value].labelKey)}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                      {t("clientsResetSettingsCancel")}
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {t("clientsCreate")}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <CardDescription>{t("clientsDescription")}</CardDescription>
          <p className="text-sm text-muted-foreground">
            {t("clientsKvDelayNote")}
          </p>
        </CardHeader>
        <CardContent>
          {!clientsQuery.isPending && clientsQuery.data?.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{t("clientsEmpty")}</div>
          )}
          {(clientsQuery.data?.length ?? 0) > 0 && (
          <Tabs
            activationMode="manual"
            value={selectedClient?.id ?? ""}
            onValueChange={(value) => {
              const client = clientsQuery.data?.find(({ id }) => id === value);
              if (!client) return;

              void navigate({
                to: "/clients/$platform/$tab",
                params: {
                  platform: client.id,
                  tab: "basic",
                },
              });
            }}
          >
            <div className="flex min-w-0 items-center gap-2">
            <div className="relative min-w-0 flex-1">
            <TabsList className="client-tabs-scrollbar h-auto w-full min-w-0 flex-nowrap justify-start gap-2 rounded-none bg-transparent p-0 pb-2 pr-6">
              {clientsQuery.data?.map((client) => {
                const PlatformIcon = platformMetaMap[client.platform].icon;

                return (
                  <TabsTrigger
                    key={client.id}
                    value={client.id}
                    className="h-11 max-w-52 gap-2 rounded-lg border border-border bg-background px-4 font-medium tracking-tight text-muted-foreground shadow-sm data-[state=active]:border-primary/50 data-[state=active]:bg-primary/10 data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                  >
                    <PlatformIcon className="size-4 shrink-0" />
                    <span className="truncate">{client.name}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 bottom-2 w-6 bg-linear-to-r from-transparent via-white/60 to-white"
            />
            </div>
            <div className="flex self-stretch items-center">
            <Dialog open={searchOpen} onOpenChange={(open) => {
              setSearchOpen(open);
              if (!open) setSearchQuery("");
            }}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label={t("clientsSearch")}>
                  <Search />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("clientsSearch")}</DialogTitle>
                  <DialogDescription>{t("clientsSearchDescription")}</DialogDescription>
                </DialogHeader>
                <Input
                  autoFocus
                  value={searchQuery}
                  placeholder={t("clientsSearchPlaceholder")}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
                <div className="grid max-h-80 gap-1 overflow-y-auto">
                  {filteredClients.map((client) => {
                    const PlatformIcon = platformMetaMap[client.platform].icon;
                    return (
                      <button
                        key={client.id}
                        type="button"
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => selectClient(client.id)}
                      >
                        <PlatformIcon className="size-5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate font-medium">{client.name}</span>
                      </button>
                    );
                  })}
                  {filteredClients.length === 0 && (
                    <div className="py-8 text-center text-sm text-muted-foreground">{t("clientsSearchEmpty")}</div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            </div>
            </div>

            {selectedClient && (
              <TabsContent key={selectedClient.id} value={selectedClient.id}>
                {clientConfigQuery.isPending ? (
                  <RouteLoading />
                ) : clientConfigQuery.data ? (
                  <div className="grid gap-4">
                  <div className="rounded-lg border border-border p-4">
                    <div className="font-medium">{clientConfigQuery.data.name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">slug: {clientConfigQuery.data.slug}</div>
                  </div>
                  <Tabs
                    activationMode="manual"
                    value={activeTab}
                    onValueChange={(value) => {
                      if (!isClientTab(value) || !availableTabs.includes(value)) {
                        return;
                      }

                      void navigate({
                        to: "/clients/$platform/$tab",
                        params: {
                          platform: selectedClient.id,
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
                            const updatedClientConfig = await updateTelegramSettings(selectedClient.id, values);
                            const cachedClientConfig = queryClient.getQueryData<ClientConfigResponse>(
                              ["client-config", selectedClient.id],
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
                              ["client-config", selectedClient.id],
                              mergedClientConfig,
                            );

                            return mergedClientConfig;
                          }}
                          onSaveBasicSettings={async (values: ClientBasicSettingsPatch) => {
                            const updatedClientConfig = await updateClientBasicSettings(
                              selectedClient.id,
                              values,
                            );

                            queryClient.setQueryData(
                              ["client-config", selectedClient.id],
                              updatedClientConfig,
                            );

                            return updatedClientConfig.basicSettings;
                          }}
                          onDelete={handleDeleteClient}
                        />
                      ) : (
                        <ClientBasicSettingsTab
                          platform={platform}
                          basicSettings={clientConfigQuery.data.basicSettings}
                          clientId={clientConfigQuery.data.id}
                          onSaveBasicSettings={async (values: ClientBasicSettingsPatch) => {
                            const updatedClientConfig = await updateClientBasicSettings(
                              selectedClient.id,
                              values,
                            );

                            queryClient.setQueryData(
                              ["client-config", selectedClient.id],
                              updatedClientConfig,
                            );

                            return updatedClientConfig.basicSettings;
                          }}
                          onDelete={handleDeleteClient}
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
                                  selectedClient.id,
                                  values,
                                );

                              queryClient.setQueryData(
                                ["client-config", selectedClient.id],
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
                      {clientConfigQuery.data.platform === "telegram" ? (
                        <TelegramAuthSettingsTab
                          settings={clientConfigQuery.data.telegramSettings}
                          onSave={async (values) => {
                            const updatedClientConfig = await updateTelegramSettings(selectedClient.id, values);

                            queryClient.setQueryData(
                              ["client-config", selectedClient.id],
                              updatedClientConfig,
                            );

                            if (updatedClientConfig.platform !== "telegram") {
                              throw new Error("Telegram settings are unavailable for this client");
                            }

                            return updatedClientConfig.telegramSettings;
                          }}
                        />
                      ) : (
                        <AuthSettingsTab
                          settings={clientConfigQuery.data.authSettings}
                          onSave={async (values: ClientAuthSettings) => {
                            const updatedClientConfig = await updateClientAuthSettings(
                              selectedClient.id,
                              values,
                            );

                            queryClient.setQueryData(
                              ["client-config", selectedClient.id],
                              updatedClientConfig,
                            );

                            return updatedClientConfig.authSettings;
                          }}
                        />
                      )}
                    </TabsContent>

                    {availableTabs.includes("cors") && (
                      <TabsContent value="cors">
                        {"corsSettings" in clientConfigQuery.data && (
                          <CorsSettingsTab
                            settings={clientConfigQuery.data.corsSettings}
                            onSave={async (values: ClientCorsSettings) => {
                              const updatedClientConfig =
                                await updateClientCorsSettings(selectedClient.id, values);

                              queryClient.setQueryData(
                                ["client-config", selectedClient.id],
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
                        platform={platform}
                        usageLimit={clientConfigQuery.data.usageLimit}
                        onSave={async (values: ClientUsageLimit) => {
                          const updatedClientConfig = await updateClientUsageLimit(
                            selectedClient.id,
                            values,
                          );

                          queryClient.setQueryData(
                            ["client-config", selectedClient.id],
                            updatedClientConfig,
                          );

                          return updatedClientConfig.usageLimit;
                        }}
                      />
                    </TabsContent>
                  </Tabs>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    {t("clientsLoadFailed")}
                  </div>
                )}
              </TabsContent>
            )}
          </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
