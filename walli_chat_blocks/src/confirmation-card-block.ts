import type { WalliChatBlockContext, WalliChatTokenizedBlockDefinition } from "@walli/chat";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import { html, nothing } from "lit";
import { z } from "zod";
import { blockBaseStyles } from "./block-theme.js";
import walliChatBlocksUnoCss from "virtual:walli-chat-blocks-uno-styles";

dayjs.extend(customParseFormat);

const cardWidth = 360;
const cardPaddingTop = 12;
const cardPaddingBottom = 16;
const titleHeight = 20;
const titleFieldGap = 12;
const fieldHeight = 58;
const fieldGap = 10;
const actionMarginTop = 16;
const actionHeight = 40;

type ConfirmationFieldBase = {
  editable?: boolean;
  id: string;
  label: string;
  required?: boolean;
};

export type ConfirmationTextField = ConfirmationFieldBase & {
  maxLength?: number;
  minLength?: number;
  type: "text";
  value?: string;
};

export type ConfirmationNumberField = ConfirmationFieldBase & {
  decimals?: number;
  max?: number;
  min?: number;
  type: "number";
  value?: number;
};

export type ConfirmationTimeField = ConfirmationFieldBase & {
  format: "YYYY-MM-DD" | "YYYY-MM-DD HH:mm";
  max?: string;
  min?: string;
  type: "time";
  value?: string;
};

export type ConfirmationCardField =
  ConfirmationTextField | ConfirmationNumberField | ConfirmationTimeField;

export type ConfirmationCardAction = {
  disabled?: boolean;
  id: string;
  label?: string;
};

export type ConfirmationCardData = {
  action: ConfirmationCardAction;
  fields: readonly ConfirmationCardField[];
  title?: string;
};

export type ConfirmationCardSubmission = {
  action: string;
  fields: Record<string, string | number>;
  type: "confirmation-card";
};

const editedValuesByCard = new WeakMap<ConfirmationCardData, Map<string, string>>();

const baseFieldSchema = z.object({
  editable: z.boolean().optional(),
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  required: z.boolean().optional(),
});

const textFieldSchema = baseFieldSchema
  .extend({
    maxLength: z.number().int().nonnegative().optional(),
    minLength: z.number().int().nonnegative().optional(),
    type: z.literal("text"),
    value: z.string().optional(),
  })
  .refine(
    (field) =>
      field.maxLength === undefined ||
      field.minLength === undefined ||
      field.minLength <= field.maxLength,
    {
      message: "minLength cannot exceed maxLength",
    },
  );

const numberFieldSchema = baseFieldSchema
  .extend({
    decimals: z.number().int().min(0).max(20).optional(),
    max: z.number().finite().optional(),
    min: z.number().finite().optional(),
    type: z.literal("number"),
    value: z.number().finite().optional(),
  })
  .refine((field) => field.max === undefined || field.min === undefined || field.min <= field.max, {
    message: "min cannot exceed max",
  });

const timeFormatSchema = z.enum(["YYYY-MM-DD", "YYYY-MM-DD HH:mm"]);
const timeFieldSchema = baseFieldSchema
  .extend({
    format: timeFormatSchema,
    max: z.string().optional(),
    min: z.string().optional(),
    type: z.literal("time"),
    value: z.string().optional(),
  })
  .superRefine((field, context) => {
    for (const key of ["min", "max", "value"] as const) {
      const value = field[key];
      if (value === undefined || (key === "min" && value === "now")) continue;
      if (!dayjs(value, field.format, true).isValid()) {
        context.addIssue({
          code: "custom",
          message: `${key} must match ${field.format}`,
          path: [key],
        });
      }
    }
    const minimum =
      field.min === "now"
        ? dayjs()
        : field.min === undefined
          ? null
          : dayjs(field.min, field.format, true);
    const maximum = field.max === undefined ? null : dayjs(field.max, field.format, true);
    if (minimum?.isValid() && maximum?.isValid() && maximum.isBefore(minimum)) {
      context.addIssue({
        code: "custom",
        message: "max cannot be earlier than min",
        path: ["max"],
      });
    }
  });

const confirmationCardSchema = z
  .object({
    action: z.object({
      disabled: z.boolean().optional(),
      id: z.string().trim().min(1),
      label: z.string().trim().min(1).optional(),
    }),
    fields: z.array(z.union([textFieldSchema, numberFieldSchema, timeFieldSchema])).min(1),
    title: z.string().trim().min(1).optional(),
  })
  .superRefine((card, context) => {
    const ids = new Set<string>();
    card.fields.forEach((field, index) => {
      if (ids.has(field.id)) {
        context.addIssue({
          code: "custom",
          message: "Field ids must be unique",
          path: ["fields", index, "id"],
        });
      }
      ids.add(field.id);
    });
  });

const invalidFieldClass = "[border-color:var(--walli-block-error)]";

export const confirmationCardBlockDefinition = {
  name: "confirmation-card",
  marginTop: 12,
  styles: [walliChatBlocksUnoCss, blockBaseStyles],
  tokenizer: {
    tokenize(source) {
      const match = /^:::confirmation-card[ \t]*\n([\s\S]*?)\n:::[ \t]*(?:\n|$)/.exec(source);
      if (!match) return undefined;
      let input: unknown;
      try {
        input = JSON.parse(match[1] ?? "");
      } catch {
        throw new Error("Confirmation card must contain valid JSON");
      }
      return { data: confirmationCardSchema.parse(input) as ConfirmationCardData, raw: match[0] };
    },
  },
  measure(data, { availableWidth }) {
    const fieldsHeight =
      data.fields.length * fieldHeight + Math.max(0, data.fields.length - 1) * fieldGap;
    return {
      height:
        cardPaddingTop +
        cardPaddingBottom +
        (data.title === undefined ? 0 : titleHeight + titleFieldGap) +
        fieldsHeight +
        actionMarginTop +
        actionHeight,
      width: Math.min(cardWidth, availableWidth),
    };
  },
  render({ ctx, data, height, messageId, width }) {
    return html`<form
      class="box-border flex w-full flex-col rounded-xl border border-solid [background:var(--walli-card)] [border-color:var(--walli-border)] p-3 pb-4 [box-shadow:var(--walli-block-shadow)] [color:var(--walli-card-foreground)]"
      style=${`width:${width}px;height:${height}px`}
      @submit=${(event: SubmitEvent) => submitCard(event, ctx, data, messageId)}
      novalidate
    >
      ${
        data.title === undefined
          ? nothing
          : html`<h3 class="m-0 mb-3 h-5 text-sm font-semibold leading-5">${data.title}</h3>`
      }
      <div class="flex flex-col gap-2.5">
        ${data.fields.map((field) => renderField(data, field))}
      </div>
      <button
        class="mt-4 h-10 shrink-0 cursor-pointer rounded-lg border-0 [background:var(--walli-primary)] px-3 text-sm font-semibold [color:var(--walli-primary-foreground)] enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        type="submit"
        ?disabled=${ctx.isStreaming || data.action.disabled === true}
      >
        ${data.action.label ?? "Confirm"}
      </button>
    </form>`;
  },
} satisfies WalliChatTokenizedBlockDefinition<ConfirmationCardData>;

export function createConfirmationCardMarkdown(data: ConfirmationCardData): string {
  const parsed = confirmationCardSchema.parse(data);
  return `:::confirmation-card\n${JSON.stringify(parsed, null, 2)}\n:::`;
}

function renderField(data: ConfirmationCardData, field: ConfirmationCardField) {
  const editable = field.editable ?? true;
  const inputId = `confirmation-field-${field.id}`;
  return html`<div class="relative h-[58px]" data-field-id=${field.id}>
    <label class="block h-[18px] text-sm font-medium leading-[18px]" for=${inputId}
      >${field.label}${field.required ? " *" : ""}</label
    >
    ${
      editable
        ? renderInput(data, field, inputId)
        : html`<div
            class="mt-1.5 box-border h-[34px] overflow-hidden rounded-md [background:var(--walli-muted)] px-2.5 text-sm leading-[34px]"
            data-readonly-value
          >
            ${formatFieldValue(field)}
          </div>`
    }
    <div
      class="absolute right-0 top-0 h-[18px] max-w-[60%] overflow-hidden text-ellipsis whitespace-nowrap text-right text-[11px] leading-[18px] [color:var(--walli-block-error)]"
      data-error-for=${field.id}
    ></div>
  </div>`;
}

function renderInput(data: ConfirmationCardData, field: ConfirmationCardField, inputId: string) {
  const cachedValue = getEditedValue(data, field);
  if (field.type === "text") {
    return html`<input
      class="mt-1.5 box-border block h-[34px] w-full rounded-md border border-solid [background:var(--walli-background)] [border-color:var(--walli-border)] px-2.5 text-sm text-inherit focus:[border-color:var(--walli-ring)] focus:outline-none"
      id=${inputId}
      name=${field.id}
      type="text"
      value=${cachedValue}
      @input=${(event: InputEvent) => cacheEditedValue(data, field.id, event)}
      minlength=${field.minLength ?? nothing}
      maxlength=${field.maxLength ?? nothing}
    />`;
  }
  if (field.type === "number") {
    return html`<input
      class="mt-1.5 box-border block h-[34px] w-full rounded-md border border-solid [background:var(--walli-background)] [border-color:var(--walli-border)] px-2.5 text-sm text-inherit focus:[border-color:var(--walli-ring)] focus:outline-none"
      id=${inputId}
      name=${field.id}
      type="number"
      value=${cachedValue}
      @input=${(event: InputEvent) => cacheEditedValue(data, field.id, event)}
      min=${field.min ?? nothing}
      max=${field.max ?? nothing}
      step=${field.decimals === undefined ? "any" : 10 ** -field.decimals}
    />`;
  }
  return html`<input
    class="mt-1.5 box-border block h-[34px] w-full rounded-md border border-solid [background:var(--walli-background)] [border-color:var(--walli-border)] px-2.5 text-sm text-inherit [color-scheme:inherit] focus:[border-color:var(--walli-ring)] focus:outline-none"
    id=${inputId}
    name=${field.id}
    type=${field.format === "YYYY-MM-DD" ? "date" : "datetime-local"}
    value=${cachedValue}
    @input=${(event: InputEvent) => cacheEditedValue(data, field.id, event)}
    min=${toInputTime(field.min === "now" ? dayjs().format(field.format) : field.min, field.format)}
    max=${toInputTime(field.max, field.format)}
  />`;
}

function getEditedValue(data: ConfirmationCardData, field: ConfirmationCardField): string {
  const cachedValue = editedValuesByCard.get(data)?.get(field.id);
  if (cachedValue !== undefined) return cachedValue;
  if (field.type === "time") return toInputTime(field.value, field.format);
  return field.value?.toString() ?? "";
}

function cacheEditedValue(data: ConfirmationCardData, fieldId: string, event: InputEvent): void {
  let values = editedValuesByCard.get(data);
  if (values === undefined) {
    values = new Map<string, string>();
    editedValuesByCard.set(data, values);
  }
  values.set(fieldId, (event.currentTarget as HTMLInputElement).value);
}

async function submitCard(
  event: SubmitEvent,
  ctx: WalliChatBlockContext,
  data: ConfirmationCardData,
  messageId: string,
) {
  event.preventDefault();
  if (ctx.isStreaming) return;
  const form = event.currentTarget as HTMLFormElement;
  clearErrors(form);
  const result: Record<string, string | number> = {};
  let valid = true;
  for (const field of data.fields) {
    const rawValue = readFieldValue(form, field);
    const validation = validateFieldValue(field, rawValue);
    if (!validation.success) {
      setFieldError(form, field.id, validation.error);
      valid = false;
    } else if (validation.value !== undefined) {
      result[field.id] = validation.value;
    }
  }
  if (!valid) return;

  setFormDisabled(form, true);
  const submission: ConfirmationCardSubmission = {
    action: data.action.id,
    fields: result,
    type: "confirmation-card",
  };
  try {
    const handled = await ctx.action({
      data: submission,
      messageId,
      name: "confirmation-card",
    });
    if (!handled) setFormDisabled(form, false);
  } catch (error) {
    setFormDisabled(form, false);
    throw error;
  }
}

function readFieldValue(form: HTMLFormElement, field: ConfirmationCardField): string {
  if (field.editable === false) return field.value?.toString() ?? "";
  return (form.elements.namedItem(field.id) as HTMLInputElement | null)?.value.trim() ?? "";
}

function validateFieldValue(
  field: ConfirmationCardField,
  rawValue: string,
): { success: true; value?: string | number } | { error: string; success: false } {
  if (rawValue.length === 0) {
    return field.required ? { error: "This field is required", success: false } : { success: true };
  }
  if (field.type === "text") {
    let schema = z.string();
    if (field.minLength !== undefined)
      schema = schema.min(field.minLength, `Minimum ${field.minLength} characters`);
    if (field.maxLength !== undefined)
      schema = schema.max(field.maxLength, `Maximum ${field.maxLength} characters`);
    const parsed = schema.safeParse(rawValue);
    return parsed.success
      ? { success: true, value: parsed.data }
      : { error: parsed.error.issues[0]!.message, success: false };
  }
  if (field.type === "number") {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return { error: "Enter a valid number", success: false };
    if (field.min !== undefined && value < field.min)
      return { error: `Minimum value is ${field.min}`, success: false };
    if (field.max !== undefined && value > field.max)
      return { error: `Maximum value is ${field.max}`, success: false };
    if (field.decimals !== undefined && decimalPlaces(rawValue) > field.decimals) {
      return { error: `Maximum ${field.decimals} decimal places`, success: false };
    }
    return { success: true, value };
  }
  const value = fromInputTime(rawValue, field.format);
  const parsed = dayjs(value, field.format, true);
  if (!parsed.isValid()) return { error: `Use format ${field.format}`, success: false };
  const minimum =
    field.min === "now" ? dayjs() : field.min ? dayjs(field.min, field.format, true) : null;
  const maximum = field.max ? dayjs(field.max, field.format, true) : null;
  if (minimum && parsed.isBefore(minimum))
    return {
      error: field.min === "now" ? "Time cannot be in the past" : `Minimum time is ${field.min}`,
      success: false,
    };
  if (maximum && parsed.isAfter(maximum))
    return { error: `Maximum time is ${field.max}`, success: false };
  return { success: true, value };
}

function formatFieldValue(field: ConfirmationCardField): string {
  if (field.value === undefined || field.value === "") return "—";
  return field.type === "number" && field.decimals !== undefined
    ? field.value.toFixed(field.decimals)
    : field.value.toString();
}

function toInputTime(value: string | undefined, format: ConfirmationTimeField["format"]): string {
  if (!value) return "";
  return format === "YYYY-MM-DD HH:mm" ? value.replace(" ", "T") : value;
}

function fromInputTime(value: string, format: ConfirmationTimeField["format"]): string {
  return format === "YYYY-MM-DD HH:mm" ? value.replace("T", " ") : value;
}

function decimalPlaces(value: string): number {
  return value.includes(".") ? value.split(".")[1]!.length : 0;
}

function clearErrors(form: HTMLFormElement): void {
  form.querySelectorAll<HTMLElement>("[data-error-for]").forEach((element) => {
    element.textContent = "";
  });
  form.querySelectorAll<HTMLElement>('[aria-invalid="true"]').forEach((element) => {
    element.removeAttribute("aria-invalid");
    element.classList.remove(invalidFieldClass);
  });
}

function setFieldError(form: HTMLFormElement, id: string, error: string): void {
  const element = form.querySelector<HTMLElement>(`[data-error-for="${CSS.escape(id)}"]`);
  if (element) element.textContent = error;
  const field = form.querySelector<HTMLElement>(`[data-field-id="${CSS.escape(id)}"]`);
  const valueElement = field?.querySelector<HTMLElement>("input, [data-readonly-value]");
  valueElement?.setAttribute("aria-invalid", "true");
  valueElement?.classList.add(invalidFieldClass);
}

function setFormDisabled(form: HTMLFormElement, disabled: boolean): void {
  form
    .querySelectorAll<HTMLInputElement | HTMLButtonElement>("input, button")
    .forEach((element) => {
      element.disabled = disabled;
    });
}
