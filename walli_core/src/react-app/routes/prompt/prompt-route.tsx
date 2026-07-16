import { useState } from "react";
import { useTranslation } from "react-i18next";
import { defaultSystemPromptKey } from "./system-prompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export function PromptRoute() {
  const { t } = useTranslation();
  const defaultSystemPrompt = t(defaultSystemPromptKey);
  const [systemPrompt, setSystemPrompt] = useState(defaultSystemPrompt);

  return (
    <div className="p-4 lg:p-6">
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>{t("promptTitle")}</CardTitle>
          <CardDescription>{t("promptDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="system-prompt">{t("promptLabel")}</Label>
            <textarea
              id="system-prompt"
              className="min-h-48 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              value={systemPrompt}
              onChange={(event) => setSystemPrompt(event.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSystemPrompt(defaultSystemPrompt)}
            >
              {t("promptReset")}
            </Button>
            <Button type="button">{t("promptSave")}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
