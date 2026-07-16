import { useTranslation } from "react-i18next";

export function DashboardRoute() {
  const { t } = useTranslation();

  return (
    <div className="p-4 lg:p-6">
      <h2 className="text-2xl font-semibold tracking-tight">{t("routeDashboard")}</h2>
    </div>
  );
}
