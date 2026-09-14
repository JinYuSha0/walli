import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-4xl border border-input bg-background px-3 py-1 text-base transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:opacity-100 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        props.readOnly && "cursor-default border-transparent bg-muted text-muted-foreground shadow-none",
        type === "file" && "h-auto min-h-9 cursor-pointer py-1 file:mr-3 file:cursor-pointer file:rounded-full file:bg-primary file:px-3 file:text-primary-foreground enabled:hover:file:bg-primary/90 disabled:file:cursor-not-allowed disabled:file:bg-muted disabled:file:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Input }
