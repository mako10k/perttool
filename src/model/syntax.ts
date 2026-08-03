import type { Diagnostic, DiagnosticCounts, SourceSpan } from "./diagnostics.js";

export type DeclarationKind =
  | "project"
  | "resource"
  | "milestone"
  | "task"
  | "gate";

export type TargetDeclarationKind =
  | DeclarationKind
  | "task_relation"
  | "plan_seal"
  | "task_outcome"
  | "assurance_receipt"
  | "work_event";

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

export interface PersonHoursValue {
  readonly text: string;
  readonly digits: bigint;
  readonly scale: number;
  readonly suffix: "ph";
}

export interface PersonHoursFractionValue {
  readonly text: string;
  readonly numerator: bigint;
  readonly denominator: bigint;
  readonly suffix: "ph";
}

export type ExactPersonHoursValue =
  | PersonHoursValue
  | PersonHoursFractionValue;

export type WorkEventKind = "start" | "suspend" | "resume" | "finish";

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

export interface AcceptedPlanningInputValue {
  readonly predecessorTaskId: string;
  readonly relationMode: "both" | "planning_only";
  readonly assuranceHash: string;
  readonly span: SourceSpan;
  readonly predecessorSpan: SourceSpan;
  readonly modeSpan: SourceSpan;
  readonly hashSpan: SourceSpan;
}

export interface AssuranceConsumerValue {
  readonly consumerTaskId: string;
  readonly relationMode: "both" | "planning_only";
  readonly span: SourceSpan;
  readonly consumerSpan: SourceSpan;
  readonly modeSpan: SourceSpan;
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

export interface DeclarationNode<
  Kind extends TargetDeclarationKind = DeclarationKind,
> {
  readonly kind: Kind;
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

export interface DocumentNode<
  Kind extends TargetDeclarationKind = DeclarationKind,
> {
  readonly text: string;
  readonly declarations: readonly DeclarationNode<Kind>[];
  readonly trivia: readonly TriviaNode[];
}

export interface ParseResult<
  Kind extends TargetDeclarationKind = DeclarationKind,
> {
  readonly document: DocumentNode<Kind>;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticCounts: DiagnosticCounts;
  readonly diagnosticsTruncated: boolean;
}

export function fieldsNamed<Kind extends TargetDeclarationKind>(
  declaration: DeclarationNode<Kind>,
  name: string,
): readonly FieldNode[] {
  return declaration.fields.filter((field) => field.name === name);
}

export function fieldNamed<Kind extends TargetDeclarationKind>(
  declaration: DeclarationNode<Kind>,
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
