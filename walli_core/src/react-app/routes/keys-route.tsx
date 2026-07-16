import { useTranslation } from "react-i18next";

export function KeysRoute() {
  const { t } = useTranslation();

  return (
    <div className="p-4 lg:p-6">
      <h2 className="text-2xl font-semibold tracking-tight">{t("routeKeys")}</h2>
    </div>
  );
}
