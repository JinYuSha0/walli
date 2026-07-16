import { useTranslation } from "react-i18next";
import walliIcon from "@/assets/walli-icon.png";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <img
        src={walliIcon}
        alt=""
        className="size-8 shrink-0 rounded-xl object-cover shadow-xs ring-1 ring-border"
      />
      <span className="text-base font-semibold">{t("appBrand")}</span>
    </span>
  );
}
