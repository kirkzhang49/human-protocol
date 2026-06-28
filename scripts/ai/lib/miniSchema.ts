/**
 * 零依赖 JSON Schema 校验器（够用子集：type / enum / required / properties / items / nullable）。
 * 仓库没装 ajv，AI 工具自身又要校验 ConfigCard/分类结果契约，故自带一个小实现。
 */
export interface SchemaError { path: string; message: string }

type JsonType = "object" | "array" | "string" | "number" | "integer" | "boolean" | "null";

export interface Schema {
  type?: JsonType | JsonType[];
  enum?: unknown[];
  required?: string[];
  properties?: Record<string, Schema>;
  items?: Schema;
  nullable?: boolean;
  [k: string]: unknown;
}

function typeOf(v: unknown): JsonType {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v as JsonType;
}

function matchesType(v: unknown, t: JsonType): boolean {
  const actual = typeOf(v);
  if (t === "number") return actual === "number" || actual === "integer";
  return actual === t;
}

export function validate(schema: Schema, data: unknown, path = "$"): SchemaError[] {
  const errors: SchemaError[] = [];

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const allowNull = schema.nullable || types.includes("null");
    if (!(data === null && allowNull) && !types.some((t) => matchesType(data, t))) {
      errors.push({ path, message: `应为 ${types.join("|")}，实为 ${typeOf(data)}` });
      return errors; // 类型错了就别往下钻
    }
  }

  if (schema.enum && !schema.enum.includes(data as never)) {
    errors.push({ path, message: `值 ${JSON.stringify(data)} 不在 enum [${schema.enum.join(",")}]` });
  }

  if (typeOf(data) === "object" && data) {
    const obj = data as Record<string, unknown>;
    for (const req of schema.required ?? []) {
      if (!(req in obj)) errors.push({ path: `${path}.${req}`, message: "缺必填字段" });
    }
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (key in obj) errors.push(...validate(sub, obj[key], `${path}.${key}`));
    }
  }

  if (typeOf(data) === "array" && schema.items) {
    (data as unknown[]).forEach((item, i) => errors.push(...validate(schema.items!, item, `${path}[${i}]`)));
  }

  return errors;
}
