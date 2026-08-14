import type {
  DeclarationNode,
  DocumentNode,
  FieldNode,
  TargetDeclarationKind,
} from "../model/syntax.js";
import { sha256DigestUtf8 } from "../model/sha256.js";

export const EDITOR_SEMANTIC_FINGERPRINT_SCHEMA_VERSION =
  "Perttool.EditorSemanticFingerprint.v1" as const;

export interface EditorSemanticFingerprintV1 {
  readonly schemaVersion: typeof EDITOR_SEMANTIC_FINGERPRINT_SCHEMA_VERSION;
  readonly digest: `sha256:${string}`;
}

interface CanonicalObject {
  readonly [key: string]: CanonicalValue;
}

interface CanonicalArray extends ReadonlyArray<CanonicalValue> {}

type CanonicalValue = null | boolean | number | string | CanonicalArray | CanonicalObject;

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function normalizedRatio(
  numerator: bigint,
  denominator: bigint,
): CanonicalObject {
  if (denominator <= 0n) {
    throw new TypeError("editor semantic value has a non-positive denominator");
  }
  const divisor = greatestCommonDivisor(numerator, denominator);
  return Object.freeze({
    numerator: (numerator / divisor).toString(),
    denominator: (denominator / divisor).toString(),
  });
}

function record(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decimalValue(
  value: Readonly<Record<string, unknown>>,
): CanonicalObject | null {
  if (
    typeof value["digits"] !== "bigint" ||
    !Number.isSafeInteger(value["scale"]) ||
    (value["scale"] as number) < 0 ||
    typeof value["suffix"] !== "string"
  ) return null;
  return Object.freeze({
    kind: "exact",
    ...normalizedRatio(
      value["digits"],
      10n ** BigInt(value["scale"] as number),
    ),
    suffix: value["suffix"],
  });
}

function fractionValue(
  value: Readonly<Record<string, unknown>>,
): CanonicalObject | null {
  if (
    typeof value["numerator"] !== "bigint" ||
    typeof value["denominator"] !== "bigint"
  ) return null;
  return Object.freeze({
    kind: "exact",
    ...normalizedRatio(value["numerator"], value["denominator"]),
    ...(typeof value["suffix"] === "string"
      ? { suffix: value["suffix"] }
      : {}),
  });
}

function calendarValue(
  value: Readonly<Record<string, unknown>>,
): CanonicalObject | null {
  if (
    (value["kind"] !== "date" && value["kind"] !== "date_time") ||
    !Number.isSafeInteger(value["year"]) ||
    !Number.isSafeInteger(value["month"]) ||
    !Number.isSafeInteger(value["day"])
  ) return null;
  if (value["kind"] === "date") {
    return Object.freeze({
      kind: "date",
      year: value["year"] as number,
      month: value["month"] as number,
      day: value["day"] as number,
    });
  }
  if (
    !Number.isSafeInteger(value["hour"]) ||
    !Number.isSafeInteger(value["minute"]) ||
    !Number.isSafeInteger(value["offsetMinutes"]) ||
    !record(value["second"])
  ) return null;
  const second = fractionValue(value["second"]);
  if (second === null) return null;
  return Object.freeze({
    kind: "date_time",
    year: value["year"] as number,
    month: value["month"] as number,
    day: value["day"] as number,
    hour: value["hour"] as number,
    minute: value["minute"] as number,
    second,
    offsetMinutes: value["offsetMinutes"] as number,
  });
}

function velocityValue(
  value: Readonly<Record<string, unknown>>,
): CanonicalObject | null {
  if (!record(value["points"]) || !record(value["period"])) return null;
  const points = decimalValue(value["points"]);
  const period = decimalValue(value["period"]);
  if (points === null || period === null) return null;
  return Object.freeze({ kind: "velocity", points, period });
}

function canonicalSemanticValue(value: unknown): CanonicalValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError("editor semantic value contains a non-integer number");
    }
    return value;
  }
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => canonicalSemanticValue(item)));
  }
  if (!record(value)) {
    throw new TypeError("editor semantic value is not canonicalizable");
  }

  const decimal = decimalValue(value);
  if (decimal !== null) return decimal;
  const fraction = fractionValue(value);
  if (fraction !== null) return fraction;
  const calendar = calendarValue(value);
  if (calendar !== null) return calendar;
  const velocity = velocityValue(value);
  if (velocity !== null) return velocity;

  const result: Record<string, CanonicalValue> = {};
  for (const key of Object.keys(value).sort()) {
    if (key === "span" || key.endsWith("Span") || key === "sourceText") continue;
    const child = value[key];
    if (child === undefined) {
      throw new TypeError(`editor semantic value field ${key} is undefined`);
    }
    result[key] = canonicalSemanticValue(child);
  }
  return Object.freeze(result);
}

function fieldValue(field: FieldNode): CanonicalValue {
  return Object.freeze({
    name: field.name,
    value: canonicalSemanticValue(field.value),
    ...(field.children === undefined
      ? {}
      : {
          children: Object.freeze(
            field.children.map((child) => fieldValue(child)),
          ),
        }),
  });
}

function declarationValue(
  declaration: DeclarationNode<TargetDeclarationKind>,
): CanonicalValue {
  return Object.freeze({
    kind: declaration.kind,
    id: declaration.id,
    ...(declaration.from === undefined ? {} : { from: declaration.from }),
    ...(declaration.to === undefined ? {} : { to: declaration.to }),
    fields: Object.freeze(declaration.fields.map((field) => fieldValue(field))),
  });
}

function encodeCanonicalJson(value: CanonicalValue): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => encodeCanonicalJson(item)).join(",")}]`;
  }
  return `{${Object.entries(value).map(([key, child]) =>
    `${JSON.stringify(key)}:${encodeCanonicalJson(child)}`
  ).join(",")}}`;
}

export function createEditorSemanticFingerprint(
  document: DocumentNode<TargetDeclarationKind>,
  extensions: readonly unknown[] = [],
): EditorSemanticFingerprintV1 {
  const input: CanonicalValue = Object.freeze({
    schemaVersion: EDITOR_SEMANTIC_FINGERPRINT_SCHEMA_VERSION,
    declarations: Object.freeze(
      document.declarations.map((declaration) => declarationValue(declaration)),
    ),
    extensions: Object.freeze(
      extensions.map((extension) => canonicalSemanticValue(extension)),
    ),
  });
  return Object.freeze({
    schemaVersion: EDITOR_SEMANTIC_FINGERPRINT_SCHEMA_VERSION,
    digest: sha256DigestUtf8(encodeCanonicalJson(input)),
  });
}
