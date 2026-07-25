import type { Diagnostic } from "../model/diagnostics.js";
import type { DurationValue, VelocityValue } from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import type { TargetCalendarValue } from "../model/target-calendar.js";
import type {
  TargetGrammar2Capability,
} from "../parser/document-parser.js";
import type { ProjectMetadataDurationUnit } from "./project.js";
import {
  checkTargetDocument,
  type TargetCheckOptions,
} from "./target-check.js";

export interface TargetProjectMetadata {
  readonly id: string;
  readonly version: 1 | 2;
  readonly title: string;
  readonly description: string | null;
  readonly asOf: TargetCalendarValue | null;
  readonly durationUnit: ProjectMetadataDurationUnit;
  readonly velocity: string | null;
  readonly finish: string;
  readonly finishDeadline: TargetCalendarValue | null;
  readonly criticalEpsilon: string | null;
  readonly targetDuration: string | null;
}

export interface TargetProjectMetadataResult {
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly grammarVersion: 1 | 2 | null;
  readonly project: TargetProjectMetadata | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function optionalLiteral(value: unknown): string | null {
  return value !== null &&
    typeof value === "object" &&
    typeof (value as DurationValue | VelocityValue).text === "string"
    ? (value as DurationValue | VelocityValue).text
    : null;
}

export function getTargetProjectMetadata(
  text: string,
  capability: TargetGrammar2Capability,
  options: TargetCheckOptions = {},
): TargetProjectMetadataResult {
  const checked = checkTargetDocument(text, capability, options);
  const declaration = checked.document.declarations.find(
    ({ kind }) => kind === "project",
  );
  if (
    !checked.ok ||
    declaration === undefined ||
    (checked.grammarVersion !== 1 && checked.grammarVersion !== 2)
  ) {
    return {
      ok: false,
      documentId: checked.documentId,
      grammarVersion: null,
      project: null,
      diagnostics: checked.diagnostics,
      diagnosticsTruncated: checked.diagnosticsTruncated,
    };
  }

  const title = fieldNamed(declaration, "title")?.value;
  const durationUnit = fieldNamed(declaration, "duration_unit")?.value;
  const finish = fieldNamed(declaration, "finish")?.value;
  const temporalInputs = checked.temporalInputs;
  if (
    typeof title !== "string" ||
    (durationUnit !== "day" && durationUnit !== "hour" && durationUnit !== "point") ||
    typeof finish !== "string" ||
    temporalInputs === null
  ) {
    throw new Error("valid target project document is missing required metadata");
  }
  const finishDeadline = temporalInputs.milestoneDeadlines.find(
    ({ milestoneId }) => milestoneId === finish,
  )?.deadline ?? null;

  return {
    ok: true,
    documentId: checked.documentId,
    grammarVersion: checked.grammarVersion,
    project: {
      id: declaration.id,
      version: checked.grammarVersion,
      title,
      description: optionalString(fieldNamed(declaration, "description")?.value),
      asOf: temporalInputs.anchor,
      durationUnit,
      velocity: optionalLiteral(fieldNamed(declaration, "velocity")?.value),
      finish,
      finishDeadline,
      criticalEpsilon: optionalLiteral(fieldNamed(declaration, "critical_epsilon")?.value),
      targetDuration: optionalLiteral(fieldNamed(declaration, "target_duration")?.value),
    },
    diagnostics: checked.diagnostics,
    diagnosticsTruncated: checked.diagnosticsTruncated,
  };
}
