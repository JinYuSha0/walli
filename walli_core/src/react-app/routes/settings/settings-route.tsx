import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { getSettings } from "@/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RouteLoading } from "../route-loading";
import { BasicSettingsTab } from "./components/basic-settings-tab";
import { ModelSettingsTab } from "./components/model-settings-tab";
import { SystemPromptSettingsTab } from "./components/system-prompt-settings-tab";
import { ToolSettingsTab } from "./components/tool-settings-tab";
import { UsageSettingsTab } from "./components/usage-settings-tab";

const settingsTabs = [
  "basic",
  "system-prompt",
  "model",
  "tool",
  "usage",
] as const;

type SettingsTab = (typeof settingsTabs)[number];

const isSettingsTab = (value: string): value is SettingsTab =>
  settingsTabs.includes(value as SettingsTab);

export function SettingsRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { data, isPending } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });
  const currentTab = location.pathname.split("/").at(-1) ?? "";
  const activeTab = isSettingsTab(currentTab) ? currentTab : "basic";

  if (isPending || !data) {
    return <RouteLoading />;
  }

  return (
    <div className="flex justify-center p-4 lg:p-6">
      <Card className="w-full min-w-0 max-w-5xl">
        <CardHeader>
          <CardTitle>{t("promptTitle")}</CardTitle>
          <CardDescription>{t("promptDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            className="min-w-0"
            activationMode="manual"
            value={activeTab}
            onValueChange={(value) => {
              if (!isSettingsTab(value)) {
                return;
              }

              void navigate({
                to: "/settings/$tab",
                params: {
                  tab: value,
                },
              });
            }}
          >
            <TabsList className="settings-tabs-scrollbar h-auto min-h-10 w-full min-w-0 shrink-0 sm:w-fit">
              <TabsTrigger value="basic">
                {t("settingsBasicTab")}
              </TabsTrigger>
              <TabsTrigger value="system-prompt">
                {t("systemPromptSettingsTab")}
              </TabsTrigger>
              <TabsTrigger value="model">
                {t("modelSettingsTab")}
              </TabsTrigger>
              <TabsTrigger value="tool">
                {t("toolSettingsTab")}
              </TabsTrigger>
              <TabsTrigger value="usage">
                {t("usageSettingsTab")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic">
              <BasicSettingsTab settings={data} />
            </TabsContent>

            <TabsContent value="system-prompt">
              <SystemPromptSettingsTab settings={data} />
            </TabsContent>

            <TabsContent value="model">
              <ModelSettingsTab settings={data} />
            </TabsContent>

            <TabsContent value="tool">
              <ToolSettingsTab {...data} />
            </TabsContent>

            <TabsContent value="usage">
              <UsageSettingsTab settings={data} />
            </TabsContent>

          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
