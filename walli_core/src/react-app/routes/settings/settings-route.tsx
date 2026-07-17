import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { getSettings, updateSettings } from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownEditor } from "@/components/ui/markdown_editor";
import { TextEditor } from "@/components/ui/text_editor";
import { Label } from "@/components/ui/label";
import { RouteLoading } from "../route-loading";

type SettingsForm = {
  systemPrompt: string;
  dialogSystemPrompt: string;
  dialogOpeningMessage: string;
};

export function SettingsRoute() {
  const { t } = useTranslation();
  const defaultValues = {
    systemPrompt: '',
    dialogSystemPrompt: '',
    dialogOpeningMessage: '',
  };
  const form = useForm<SettingsForm>({
    defaultValues,
  });
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });
  const updateSettingsMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (values) => {
      form.reset(values);
      toast.success(t("promptSaveSuccess"));
    },
  });

  useEffect(() => {
    if (settingsQuery.data) {
      form.reset(settingsQuery.data);
    }
  }, [form, settingsQuery.data]);

  const onSubmit = (values: SettingsForm) => {
    updateSettingsMutation.mutate(values);
  };

  if (settingsQuery.isPending) {
    return <RouteLoading />;
  }

  return (
    <div className="flex justify-center p-4 lg:p-6">
      <Card className="w-full max-w-5xl">
        <CardHeader>
          <CardTitle>{t("promptTitle")}</CardTitle>
          <CardDescription>{t("promptDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-8" onSubmit={form.handleSubmit(onSubmit)}>
            <section className="grid gap-3">
              <div className="grid gap-1">
                <Label htmlFor="system-prompt">
                  {t("promptSystemPromptTitle")}
                  <span className="text-destructive">*</span>
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("promptSystemPromptDescription")}
                </p>
              </div>
              <Controller
                control={form.control}
                name="systemPrompt"
                rules={{ required: t("promptSystemPromptRequired") }}
                render={({ field, fieldState }) => (
                  <div className="grid gap-2">
                    <TextEditor
                      id="system-prompt"
                      aria-invalid={fieldState.invalid}
                      disabled={settingsQuery.isPending || updateSettingsMutation.isPending}
                      placeholder={t("promptSystemPromptPlaceholder")}
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

            <section className="grid gap-3 border-t border-border pt-8">
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
                    disabled={settingsQuery.isPending || updateSettingsMutation.isPending}
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
                    disabled={settingsQuery.isPending || updateSettingsMutation.isPending}
                    placeholder={t("promptDialogOpeningMessagePlaceholder")}
                    {...field}
                  />
                )}
              />
            </section>

            <div className="flex justify-end gap-2 border-t border-border pt-8">
              <Button
                type="submit"
                disabled={settingsQuery.isPending || updateSettingsMutation.isPending}
              >
                {t("promptSave")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
