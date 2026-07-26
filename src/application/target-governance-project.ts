import type { Diagnostic } from "../model/diagnostics.js";
import type { DurationValue, VelocityValue } from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import {
  projectDeclaredCalendarValue,
  type TargetCalendarValue,
} from "../model/target-calendar.js";
import {
  governanceMetadataFromDocument,
  type DeclaredGovernance,
  type EffectiveGovernance,
} from "../governance/source.js";
import type { TargetGrammar4Capability } from "../parser/document-parser.js";
import {
  validateTargetGrammar4Document,
  type TargetValidationOptions,
} from "../semantic/target-validator.js";
import type { ProjectMetadataDurationUnit } from "./project.js";

export interface TargetGovernanceProjectMetadata {
  readonly id: string;
  readonly version: 1 | 2 | 3 | 4;
  readonly title: string;
  readonly description: string | null;
  readonly asOf: TargetCalendarValue | null;
  readonly durationUnit: ProjectMetadataDurationUnit;
  readonly velocity: string | null;
  readonly finish: string;
  readonly finishDeadline: TargetCalendarValue | null;
  readonly governance: {
    readonly sourceContractVersion: 1;
    readonly declared: DeclaredGovernance;
    readonly effective: EffectiveGovernance;
  };
  readonly criticalEpsilon: string | null;
  readonly targetDuration: string | null;
}

export interface TargetGovernanceProjectMetadataResult {
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly grammarVersion: 1 | 2 | 3 | 4 | null;
  readonly project: TargetGovernanceProjectMetadata | null;
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

export function getTargetGovernanceProjectMetadata(
  text: string,
  capability: TargetGrammar4Capability,
  options: TargetValidationOptions = {},
): TargetGovernanceProjectMetadataResult {
  const checked = validateTargetGrammar4Document(text, capability, options);
  const declaration = checked.validatedDocument?.document.declarations.find(
    ({ kind }) => kind === "project",
  );
  if (
    !checked.ok ||
    checked.validatedDocument === null ||
    declaration === undefined
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
  if (
    typeof title !== "string" ||
    (durationUnit !== "day" &&
      durationUnit !== "hour" &&
      durationUnit !== "point") ||
    typeof finish !== "string"
  ) {
    throw new Error("valid target project document is missing required metadata");
  }
  const asOfField = fieldNamed(declaration, "as_of");
  const asOf = asOfField === undefined
    ? null
    : projectDeclaredCalendarValue(asOfField.value);
  const finishDeclaration =
    checked.validatedDocument.document.declarations.find(
      ({ kind, id }) => kind === "milestone" && id === finish,
    );
  const finishDeadlineField = finishDeclaration === undefined
    ? undefined
    : fieldNamed(finishDeclaration, "deadline");
  const finishDeadline = finishDeadlineField === undefined
    ? null
    : projectDeclaredCalendarValue(finishDeadlineField.value);
  if (
    (asOfField !== undefined && asOf === null) ||
    (finishDeadlineField !== undefined && finishDeadline === null)
  ) {
    throw new Error("valid target project document has unprojectable calendar metadata");
  }
  return {
    ok: true,
    documentId: checked.documentId,
    grammarVersion: checked.validatedDocument.grammarVersion,
    project: Object.freeze({
      id: declaration.id,
      version: checked.validatedDocument.grammarVersion,
      title,
      description: optionalString(fieldNamed(declaration, "description")?.value),
      asOf,
      durationUnit,
      velocity: optionalLiteral(fieldNamed(declaration, "velocity")?.value),
      finish,
      finishDeadline,
      governance: Object.freeze({
        sourceContractVersion: 1,
        ...governanceMetadataFromDocument(
          checked.validatedDocument.document,
        ),
      }),
      criticalEpsilon: optionalLiteral(
        fieldNamed(declaration, "critical_epsilon")?.value,
      ),
      targetDuration: optionalLiteral(
        fieldNamed(declaration, "target_duration")?.value,
      ),
    }),
    diagnostics: checked.diagnostics,
    diagnosticsTruncated: checked.diagnosticsTruncated,
  };
}
