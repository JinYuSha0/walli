import { z } from "zod";

// Deliberately bounded JSON Schema subset. Unsupported keywords fail closed.
export type DataSchema = {
  type: "object" | "array" | "string" | "number" | "integer" | "boolean";
  description?: string;
  format?: "date-time" | "markdown";
  properties?: Record<string, DataSchema>;
  required?: string[];
  additionalProperties?: false;
  items?: DataSchema;
  enum?: (string | number | boolean)[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
};
const fieldName = z
  .string()
  .regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/)
  .refine((key) => !["constructor", "prototype", "__proto__"].includes(key));
function schemaAt(depth: number): z.ZodType<DataSchema> {
  return z
    .object({
      type: z.enum(["object", "array", "string", "number", "integer", "boolean"]),
      description: z.string().max(500).optional(),
      format: z.enum(["date-time", "markdown"]).optional(),
      properties: z
        .record(fieldName, depth < 5 ? z.lazy(() => schemaAt(depth + 1)) : z.never())
        .optional(),
      required: z.array(fieldName).max(50).optional(),
      additionalProperties: z.literal(false).optional(),
      items: depth < 5 ? z.lazy(() => schemaAt(depth + 1)).optional() : z.never().optional(),
      enum: z
        .array(z.union([z.string().max(500), z.number(), z.boolean()]))
        .min(1)
        .max(100)
        .optional(),
      minimum: z.number().optional(),
      maximum: z.number().optional(),
      minLength: z.number().int().min(0).max(16000).optional(),
      maxLength: z.number().int().min(0).max(16000).optional(),
    })
    .strict()
    .superRefine((s, ctx) => {
      const invalid = (message: string) => ctx.addIssue({ code: "custom", message });
      if (s.format && s.type !== "string") invalid("Formats require string type");
      if (s.type === "object") {
        if (!s.properties || Object.keys(s.properties).length > 50)
          invalid("Objects require at most 50 declared properties");
        if (s.required?.some((key) => !Object.hasOwn(s.properties ?? {}, key)))
          invalid("Required fields must be declared");
      } else if (s.properties || s.required || s.additionalProperties !== undefined)
        invalid("Object keywords require object type");
      if ((s.type === "array") !== !!s.items)
        invalid("Arrays require items; other types cannot have items");
      if (
        (s.minimum !== undefined || s.maximum !== undefined) &&
        !["number", "integer"].includes(s.type)
      )
        invalid("Numeric bounds require numeric type");
      if ((s.minLength !== undefined || s.maxLength !== undefined) && s.type !== "string")
        invalid("Length bounds require string type");
      if (s.minimum !== undefined && s.maximum !== undefined && s.minimum > s.maximum)
        invalid("Invalid numeric bounds");
      if (s.minLength !== undefined && s.maxLength !== undefined && s.minLength > s.maxLength)
        invalid("Invalid length bounds");
      if (s.enum?.some((v) => (s.type === "integer" ? !Number.isInteger(v) : typeof v !== s.type)))
        invalid("Enum values must match type");
    });
}
export const dataSchema = schemaAt(0).refine((s) => s.type === "object", "Root must be an object");
export const datasetInput = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(1000).default(""),
  })
  .strict();
export const categoryInput = z
  .object({ name: z.string().trim().min(1).max(100), schema: dataSchema })
  .strict();
export const categoryUpdate = categoryInput.extend({
  expectedVersion: z.number().int().positive(),
});
export const recordInput = z
  .object({
    categoryId: z.uuid().nullable().default(null),
    schemaVersion: z.number().int().positive().default(1),
    title: z.string().trim().min(1).max(200),
    data: z.record(z.string(), z.unknown()),
  })
  .strict();
export const recordUpdate = recordInput.extend({ expectedRevision: z.number().int().positive() });
export const ragInput = z
  .object({
    query: z.string().trim().max(1000).default(""),
    datasetId: z.union([z.uuid(), z.literal("")]).optional(),
    limit: z.number().int().min(1).max(10).default(5),
  })
  .strict();

export function validateData(
  schema: DataSchema,
  value: unknown,
  path = "$",
  errors: string[] = [],
): string[] {
  if (errors.length >= 20) return errors;
  const fail = (message: string) => {
    errors.push(`${path}: ${message}`);
  };
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      fail("Expected object");
      return errors;
    }
    const object = value as Record<string, unknown>;
    for (const key of schema.required ?? [])
      if (!Object.hasOwn(object, key)) fail(`Missing ${key}`);
    for (const [key, item] of Object.entries(object)) {
      if (!Object.hasOwn(schema.properties ?? {}, key)) fail(`Unknown field ${key}`);
      else validateData(schema.properties![key]!, item, `${path}.${key}`, errors);
    }
  } else if (schema.type === "array") {
    if (!Array.isArray(value) || value.length > 100) fail("Expected array with at most 100 items");
    else value.forEach((item, i) => validateData(schema.items!, item, `${path}[${i}]`, errors));
  } else {
    if (
      schema.type === "integer"
        ? typeof value !== "number" || !Number.isInteger(value)
        : typeof value !== schema.type
    )
      fail(`Expected ${schema.type}`);
    if (
      typeof value === "number" &&
      (!Number.isFinite(value) ||
        value < (schema.minimum ?? -Infinity) ||
        value > (schema.maximum ?? Infinity))
    )
      fail("Outside numeric bounds");
    if (
      typeof value === "string" &&
      (Array.from(value).length < (schema.minLength ?? 0) ||
        Array.from(value).length > (schema.maxLength ?? 16000))
    )
      fail("Outside length bounds");
    if (schema.format === "date-time" && !z.iso.datetime({ offset: true }).safeParse(value).success)
      fail("Expected ISO date and time with timezone");
    if (schema.enum && !schema.enum.includes(value as string | number | boolean))
      fail("Value is not in enum");
  }
  return errors.slice(0, 20);
}

export type Dataset = {
  id: string;
  name: string;
  description: string;
  instanceName: string;
  createdAt: number;
};
export type Category = {
  id: string;
  datasetId: string;
  name: string;
  version: number;
  schema: DataSchema;
  archivedAt: number | null;
};
export type DatasetRecord = {
  enabled: boolean;
  schema: DataSchema;
  id: string;
  datasetId: string;
  categoryId: string | null;
  schemaVersion: number;
  title: string;
  data: Record<string, unknown>;
  revision: number;
  updatedAt: number;
  syncStatus: string;
  syncError: string | null;
};
export type DatasetDetail = { dataset: Dataset; categories: Category[]; clientIds: string[] };

export const markdownRecordSchema: DataSchema = {
  type: "object",
  properties: { content: { type: "string", format: "markdown", minLength: 1, maxLength: 16000 } },
  required: ["content"],
  additionalProperties: false,
};
