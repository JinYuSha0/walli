import * as React from "react"

import { cn } from "@/lib/utils"

type TextEditorProps = Omit<
  React.ComponentProps<"textarea">,
  "onChange" | "value"
> & {
  value?: string
  onChange?: (value: string) => void
}

const TextEditor = React.forwardRef<HTMLTextAreaElement, TextEditorProps>(
  ({ className, value = "", onChange, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        data-slot="text-editor"
        className={cn(
          "min-h-48 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className
        )}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        {...props}
      />
    )
  }
)

TextEditor.displayName = "TextEditor"

export { TextEditor }
export type { TextEditorProps }
