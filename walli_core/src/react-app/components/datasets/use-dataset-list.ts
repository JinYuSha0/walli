import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { datasetsApi } from "@/datasets-api";

export function useDatasetList(enabled = true, pageSize: 9 | 10 = 9) {
  const [filter, setFilter] = useState({ page: 0, q: "" });
  const query = useQuery({
    queryKey: ["datasets", "list", pageSize, filter],
    queryFn: () => datasetsApi.list(filter.page, filter.q, pageSize),
    placeholderData: keepPreviousData,
    enabled,
  });
  return {
    query,
    ...filter,
    search: (q: string) => setFilter({ page: 0, q: q.trim() }),
    setPage: (page: number) => setFilter((current) => ({ ...current, page })),
  };
}
