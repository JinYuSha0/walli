import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function RouteLoading({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid h-full min-h-0 w-full grid-rows-[auto_auto_minmax(0,1fr)] gap-4 overflow-hidden p-4 lg:p-6",
        className
      )}
    >
      <div className="grid gap-2">
        <Skeleton className="h-7 w-40 rounded-md" />
        <Skeleton className="h-4 w-80 max-w-full rounded-md" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28 w-full rounded-md" />
        <Skeleton className="h-28 w-full rounded-md" />
        <Skeleton className="h-28 w-full rounded-md" />
      </div>
      <Skeleton className="h-full min-h-0 w-full rounded-md" />
    </div>
  );
}
