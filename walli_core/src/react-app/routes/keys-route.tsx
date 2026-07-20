import {
  IconBrandFlutter,
  IconBrandReactNative,
  IconWorldWww,
  type TablerIcon,
} from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useLocation, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  getClientConfig,
  updateClientDialogSettings,
  type ClientDialogSettings,
  type ClientPlatform,
} from "@/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CLIENT_PLATFORMS } from "../../shared/client";
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
};

const clientTabs = ["client-id", "dialog-settings"] as const;

type ClientTab = (typeof clientTabs)[number];

const isClientPlatform = (value: string): value is ClientPlatform =>
  CLIENT_PLATFORMS.includes(value as ClientPlatform);

const isClientTab = (value: string): value is ClientTab =>
  clientTabs.includes(value as ClientTab);

export function ClientsRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [, , currentPlatform = "", currentTab = ""] =
    location.pathname.split("/");
  const platform = isClientPlatform(currentPlatform) ? currentPlatform : "web";
  const activeTab = isClientTab(currentTab) ? currentTab : "client-id";
  const clientConfigQuery = useQuery({
    queryKey: ["client-config", platform],
    queryFn: () => getClientConfig(platform),
  });

  if (!isClientPlatform(currentPlatform) || !isClientTab(currentTab)) {
    return (
      <Navigate
        to="/clients/$platform/$tab"
        params={{
          platform,
          tab: activeTab,
        }}
        replace
      />
    );
  }

  return (
    <div className="flex justify-center p-4 lg:p-6">
      <Card className="w-full max-w-5xl">
        <CardHeader>
          <CardTitle>{t("clientsTitle")}</CardTitle>
          <CardDescription>{t("clientsDescription")}</CardDescription>
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
                      if (!isClientTab(value)) {
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
                      <TabsTrigger value="client-id">
                        {t("clientsClientIdTab")}
                      </TabsTrigger>
                      <TabsTrigger value="dialog-settings">
                        {t("clientsDialogSettingsTab")}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="client-id">
                      <section className="grid gap-4">
                        <h2 className="text-sm font-medium">
                          {t("clientsClientIdTitle")}
                        </h2>
                        <Label
                          className="sr-only"
                          htmlFor={`client-id-${tabPlatform}`}
                        >
                          {t("clientsClientId")}
                        </Label>
                        <Input
                          id={`client-id-${tabPlatform}`}
                          readOnly
                          value={clientConfigQuery.data.clientId}
                        />
                      </section>
                    </TabsContent>

                    <TabsContent value="dialog-settings">
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

                          return updatedClientConfig.dialogSettings;
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
