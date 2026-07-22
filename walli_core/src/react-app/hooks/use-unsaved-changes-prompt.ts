import { useBlocker } from "@tanstack/react-router";
import { isEqual } from "es-toolkit/predicate";
import { useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

export const useUnsavedChangesPrompt = <TValue>({
  current,
  saved,
  disabled = false,
}: {
  current: TValue;
  saved: TValue;
  disabled?: boolean;
}) => {
  const { t } = useTranslation();
  const suppressUntilRef = useRef(0);
  const hasUnsavedChanges = useMemo(
    () => !isEqual(current, saved),
    [current, saved],
  );
  const shouldBlockFn = useCallback(() => {
    if (Date.now() < suppressUntilRef.current) {
      return true;
    }

    const shouldLeave = window.confirm(t("unsavedChangesConfirm"));

    if (!shouldLeave) {
      suppressUntilRef.current = Date.now() + 300;
    }

    return !shouldLeave;
  }, [t]);

  useBlocker({
    disabled: disabled || !hasUnsavedChanges,
    enableBeforeUnload: hasUnsavedChanges,
    shouldBlockFn,
  });

  return hasUnsavedChanges;
};
