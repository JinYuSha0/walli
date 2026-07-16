import * as React from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"

import { cn } from "@/lib/utils"

type MarkdownEditorProps = Omit<
  React.ComponentProps<"textarea">,
  "onChange" | "value"
> & {
  value?: string
  onChange?: (value: string) => void
  editorClassName?: string
  editorStyle?: React.CSSProperties
  previewClassName?: string
  previewStyle?: React.CSSProperties
}

const previewComponents: Components = {
  a: ({ className, ...props }) => (
    <a
      className={cn("text-primary underline underline-offset-4", className)}
      rel="noreferrer"
      target="_blank"
      {...props}
    />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn(
        "border-l-4 border-border pl-4 text-muted-foreground",
        className
      )}
      {...props}
    />
  ),
  code: ({ className, ...props }) => (
    <code
      className={cn(
        "rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]",
        className
      )}
      {...props}
    />
  ),
  h1: ({ className, ...props }) => (
    <h1
      className={cn("mt-0 mb-4 text-2xl font-semibold leading-tight", className)}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cn("mt-6 mb-3 text-xl font-semibold leading-tight", className)}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      className={cn("mt-5 mb-2 text-lg font-semibold leading-tight", className)}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => (
    <hr className={cn("my-5 border-border", className)} {...props} />
  ),
  li: ({ className, ...props }) => (
    <li className={cn("pl-1", className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol className={cn("my-3 list-decimal pl-6", className)} {...props} />
  ),
  p: ({ className, ...props }) => (
    <p className={cn("my-3 leading-7", className)} {...props} />
  ),
  pre: ({ className, ...props }) => (
    <pre
      className={cn(
        "my-4 overflow-x-auto rounded-md border border-border bg-muted p-4 text-sm",
        className
      )}
      {...props}
    />
  ),
  table: ({ className, ...props }) => (
    <div className="my-4 overflow-x-auto">
      <table
        className={cn("w-full border-collapse text-sm", className)}
        {...props}
      />
    </div>
  ),
  td: ({ className, ...props }) => (
    <td className={cn("border border-border px-3 py-2", className)} {...props} />
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn(
        "border border-border bg-muted px-3 py-2 text-left font-medium",
        className
      )}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul className={cn("my-3 list-disc pl-6", className)} {...props} />
  ),
}

const MarkdownEditor = React.forwardRef<
  HTMLTextAreaElement,
  MarkdownEditorProps
>(
  (
    {
      className,
      style,
      editorClassName,
      editorStyle,
      previewClassName,
      previewStyle,
      value = "",
      onChange,
      ...props
    },
    ref
  ) => {
    return (
      <div
        data-slot="markdown-editor"
        className={cn(
          "grid min-h-72 w-full grid-cols-1 overflow-hidden rounded-md border border-input bg-background shadow-xs md:grid-cols-2",
          className
        )}
        style={style}
      >
        <textarea
          ref={ref}
          data-slot="markdown-editor-input"
          className={cn(
            "min-h-72 w-full resize-y border-0 bg-transparent px-3 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:resize-none md:border-r md:border-border",
            editorClassName
          )}
          style={editorStyle}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          {...props}
        />
        <div
          data-slot="markdown-editor-preview"
          className={cn(
            "min-h-72 overflow-auto border-t border-border px-4 py-3 text-sm text-foreground md:border-t-0",
            previewClassName
          )}
          style={previewStyle}
        >
          {value.trim() ? (
            <ReactMarkdown
              components={previewComponents}
              remarkPlugins={[remarkGfm]}
            >
              {value}
            </ReactMarkdown>
          ) : (
            <div className="text-muted-foreground">Preview</div>
          )}
        </div>
      </div>
    )
  }
)

MarkdownEditor.displayName = "MarkdownEditor"

export { MarkdownEditor }
export type { MarkdownEditorProps }
