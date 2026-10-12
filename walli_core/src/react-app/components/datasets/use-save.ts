import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
export function useSave() {
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return {
    busy,
    run: async (action: () => Promise<unknown>, done?: () => void) => {
      setBusy(true);
      try {
        await action();
        await queryClient.invalidateQueries({ queryKey: ["datasets"] });
        toast.success(t("datasets.saved"));
        done?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("datasets.failed"));
      } finally {
        setBusy(false);
      }
    },
  };
}
