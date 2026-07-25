import type { Diagnostic, DiagnosticCounts, SourceSpan } from "./diagnostics.js";

export type DeclarationKind =
  | "project"
  | "resource"
  | "milestone"
  | "task"
  | "gate";

export interface DurationValue {
  readonly text: string;
  readonly digits: bigint;
  readonly scale: number;
  readonly suffix: "d" | "h" | "p";
}

export interface DurationFractionValue {
  readonly text: string;
  readonly numerator: bigint;
  readonly denominator: bigint;
  readonly suffix: "d" | "h" | "p";
}

export type ExactDurationValue = DurationValue | DurationFractionValue;

export interface VelocityValue {
  readonly text: string;
  readonly points: DurationValue & { readonly suffix: "p" };
  readonly period: DurationValue & { readonly suffix: "d" | "h" };
}

export interface RequirementValue {
  readonly resourceId: string;
  readonly units: number;
  readonly span: SourceSpan;
  readonly resourceSpan: SourceSpan;
  readonly unitsSpan: SourceSpan;
}

export interface FieldNode {
  readonly name: string;
  readonly rawValue: string;
  readonly value: unknown;
  readonly span: SourceSpan;
  readonly valueSpan: SourceSpan;
  readonly contentSpan?: SourceSpan;
  readonly children?: readonly FieldNode[];
}

export interface DeclarationNode {
  readonly kind: DeclarationKind;
  readonly id: string;
  readonly span: SourceSpan;
  readonly idSpan: SourceSpan;
  readonly headerSpan: SourceSpan;
  readonly fields: readonly FieldNode[];
  readonly from?: string;
  readonly fromSpan?: SourceSpan;
  readonly to?: string;
  readonly toSpan?: SourceSpan;
  readonly arrowSpan?: SourceSpan;
}

export interface TriviaNode {
  readonly kind: "blank" | "comment";
  readonly text: string;
  readonly span: SourceSpan;
}

export interface DocumentNode {
  readonly text: string;
  readonly declarations: readonly DeclarationNode[];
  readonly trivia: readonly TriviaNode[];
}

export interface ParseResult {
  readonly document: DocumentNode;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticCounts: DiagnosticCounts;
  readonly diagnosticsTruncated: boolean;
}

export function fieldsNamed(
  declaration: DeclarationNode,
  name: string,
): readonly FieldNode[] {
  return declaration.fields.filter((field) => field.name === name);
}

export function fieldNamed(
  declaration: DeclarationNode,
  name: string,
): FieldNode | undefined {
  return fieldsNamed(declaration, name)[0];
}

export function compareDurations(
  left: ExactDurationValue,
  right: ExactDurationValue,
): number {
  const leftRatio = durationRatio(left);
  const rightRatio = durationRatio(right);
  const leftScaled = leftRatio.numerator * rightRatio.denominator;
  const rightScaled = rightRatio.numerator * leftRatio.denominator;
  return leftScaled < rightScaled
    ? -1
    : leftScaled > rightScaled
      ? 1
      : 0;
}

export function isZeroDuration(value: ExactDurationValue): boolean {
  return "numerator" in value
    ? value.numerator === 0n
    : value.digits === 0n;
}

function durationRatio(
  value: ExactDurationValue,
): { readonly numerator: bigint; readonly denominator: bigint } {
  return "numerator" in value
    ? { numerator: value.numerator, denominator: value.denominator }
    : {
        numerator: value.digits,
        denominator: 10n ** BigInt(value.scale),
      };
}
