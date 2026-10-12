import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function DatasetSearch({
  onSearch,
  placeholder,
}: {
  onSearch: (q: string) => void;
  placeholder?: string;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  return (
    <form
      className="flex gap-2"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(value);
      }}
    >
      <Input
        type="search"
        value={value}
        maxLength={100}
        aria-label={placeholder ?? t("datasets.searchPlaceholder")}
        placeholder={placeholder ?? t("datasets.searchPlaceholder")}
        onChange={(e) => {
          setValue(e.target.value);
          if (!e.target.value) onSearch("");
        }}
      />
      <Button type="submit" variant="outline">
        <Search className="size-4" />
        {t("datasets.search")}
      </Button>
    </form>
  );
}
export function DatasetPagination({
  page,
  hasMore,
  busy,
  onPage,
}: {
  page: number;
  hasMore: boolean;
  busy: boolean;
  onPage: (page: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t("datasets.pagination")} className="flex items-center justify-end gap-3">
      <Button
        type="button"
        variant="outline"
        disabled={page === 0 || busy}
        onClick={() => onPage(page - 1)}
      >
        {t("datasets.previous")}
      </Button>
      <span className="text-sm" aria-live="polite">
        {t("datasets.pageNumber", { page: page + 1 })}
      </span>
      <Button
        type="button"
        variant="outline"
        disabled={!hasMore || busy}
        onClick={() => onPage(page + 1)}
      >
        {t("datasets.next")}
      </Button>
    </nav>
  );
}
