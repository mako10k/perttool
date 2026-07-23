import type { Diagnostic } from "../model/diagnostics.js";
import type { DurationValue, VelocityValue } from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import { checkDocument, type CheckOptions } from "./check.js";

export type ProjectMetadataDurationUnit = "day" | "hour" | "point";

export interface ProjectMetadata {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly description: string | null;
  readonly asOf: string | null;
  readonly durationUnit: ProjectMetadataDurationUnit;
  readonly velocity: string | null;
  readonly finish: string;
  readonly criticalEpsilon: string | null;
  readonly targetDuration: string | null;
}

export interface ProjectMetadataResult {
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly grammarVersion: number | null;
  readonly project: ProjectMetadata | null;
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

export function getProjectMetadata(
  text: string,
  options: CheckOptions = {},
): ProjectMetadataResult {
  const checked = checkDocument(text, options);
  const declaration = checked.document.declarations.find(({ kind }) => kind === "project");
  if (!checked.ok || declaration === undefined || checked.grammarVersion === null) {
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
  if (
    typeof title !== "string" ||
    (durationUnit !== "day" && durationUnit !== "hour" && durationUnit !== "point") ||
    typeof finish !== "string"
  ) {
    throw new Error("valid project document is missing required project metadata");
  }

  return {
    ok: true,
    documentId: checked.documentId,
    grammarVersion: checked.grammarVersion,
    project: {
      id: declaration.id,
      version: checked.grammarVersion,
      title,
      description: optionalString(fieldNamed(declaration, "description")?.value),
      asOf: optionalString(fieldNamed(declaration, "as_of")?.value),
      durationUnit,
      velocity: optionalLiteral(fieldNamed(declaration, "velocity")?.value),
      finish,
      criticalEpsilon: optionalLiteral(fieldNamed(declaration, "critical_epsilon")?.value),
      targetDuration: optionalLiteral(fieldNamed(declaration, "target_duration")?.value),
    },
    diagnostics: checked.diagnostics,
    diagnosticsTruncated: checked.diagnosticsTruncated,
  };
}
