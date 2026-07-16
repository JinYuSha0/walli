import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  defaultDialogOpeningMessageKey,
  defaultDialogSystemPromptKey,
  defaultSystemPromptKey,
} from "./system-prompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownEditor } from "@/components/ui/markdown_editor";
import { TextEditor } from "@/components/ui/text_editor";
import { Label } from "@/components/ui/label";

type PromptSettingsForm = {
  systemPrompt: string;
  dialogSystemPrompt: string;
  dialogOpeningMessage: string;
};

const promptSettingsStorageKey = "walli_core_prompt_settings";

const getSavedPromptSettings = (
  fallbackValues: PromptSettingsForm
): PromptSettingsForm => {
  const savedSettings = window.localStorage.getItem(promptSettingsStorageKey);

  if (!savedSettings) {
    return fallbackValues;
  }

  try {
    return { ...fallbackValues, ...JSON.parse(savedSettings) };
  } catch {
    return fallbackValues;
  }
};

export function PromptRoute() {
  const { t } = useTranslation();
  const defaultValues = {
    systemPrompt: t(defaultSystemPromptKey),
    dialogSystemPrompt: t(defaultDialogSystemPromptKey),
    dialogOpeningMessage: t(defaultDialogOpeningMessageKey),
  };
  const form = useForm<PromptSettingsForm>({
    defaultValues: getSavedPromptSettings(defaultValues),
  });

  const onSubmit = (values: PromptSettingsForm) => {
    console.log(JSON.stringify(values));
    form.reset(values);
    toast.success(t("promptSaveSuccess"));
  };

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
                <Label htmlFor="system-prompt">{t("promptSystemPromptTitle")}</Label>
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
                  <TextEditor id="dialog-system-prompt" {...field} />
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
                  <MarkdownEditor id="dialog-opening-message" {...field} />
                )}
              />
            </section>

            <div className="flex justify-end gap-2 border-t border-border pt-8">
              <Button
                type="button"
                variant="outline"
                onClick={() => form.reset(defaultValues)}
              >
                {t("promptReset")}
              </Button>
              <Button type="submit">{t("promptSave")}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
