import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { updateSettings } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Settings } from "../../../../shared/const";

type UsageSettingsForm = {
  primaryModelUsageLimit: {
    dailyInputLimit: string;
    dailyOutputLimit: string;
  };
};

type UsageSettingsTabProps = {
  settings: Settings;
};

const toLimitValue = (value: number | undefined) => String(value ?? 0);

const toFormValues = (settings: Settings): UsageSettingsForm => ({
  primaryModelUsageLimit: {
    dailyInputLimit: toLimitValue(settings.primaryModelUsageLimit.dailyInputLimit),
    dailyOutputLimit: toLimitValue(settings.primaryModelUsageLimit.dailyOutputLimit),
  },
});

const parseLimit = (value: string) => {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? Math.max(0, Math.trunc(parsedValue)) : 0;
};

export function UsageSettingsTab({ settings }: UsageSettingsTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm<UsageSettingsForm>({
    defaultValues: toFormValues(settings),
  });
  const updateSettingsMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (values) => {
      queryClient.setQueryData(["settings"], values);
      form.reset(toFormValues(values));
      toast.success(t("usageSettingsSaveSuccess"));
    },
  });

  useEffect(() => {
    form.reset(toFormValues(settings));
  }, [form, settings]);

  const onSubmit = (values: UsageSettingsForm) => {
    updateSettingsMutation.mutate({
      primaryModelUsageLimit: {
        dailyInputLimit: parseLimit(values.primaryModelUsageLimit.dailyInputLimit),
        dailyOutputLimit: parseLimit(values.primaryModelUsageLimit.dailyOutputLimit),
      },
    });
  };

  return (
    <form className="grid gap-8" onSubmit={form.handleSubmit(onSubmit)}>
      <section className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="text-sm font-medium">{t("usageSettingsTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("usageSettingsDescription")}
          </p>
        </div>

        <div className="grid gap-4 rounded-lg border border-border p-4">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-medium">
              {settings.primaryModel || t("usageSettingsPrimaryModelEmpty")}
            </h3>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="usage-daily-input">
                {t("usageSettingsTotalDailyInputLimit")}
              </Label>
              <Controller
                control={form.control}
                name="primaryModelUsageLimit.dailyInputLimit"
                render={({ field }) => (
                  <Input
                    id="usage-daily-input"
                    type="number"
                    min={0}
                    step={1}
                    disabled={updateSettingsMutation.isPending}
                    {...field}
                  />
                )}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="usage-daily-output">
                {t("usageSettingsTotalDailyOutputLimit")}
              </Label>
              <Controller
                control={form.control}
                name="primaryModelUsageLimit.dailyOutputLimit"
                render={({ field }) => (
                  <Input
                    id="usage-daily-output"
                    type="number"
                    min={0}
                    step={1}
                    disabled={updateSettingsMutation.isPending}
                    {...field}
                  />
                )}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-2 border-t border-border pt-8">
        <Button type="submit" disabled={updateSettingsMutation.isPending}>
          {t("usageSettingsSave")}
        </Button>
      </div>
    </form>
  );
}
