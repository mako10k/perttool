import type { Diagnostic } from "../model/diagnostics.js";
import type {
  DeclarationNode,
  DocumentNode,
} from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import {
  projectDeclaredCalendarValue,
  type TargetCalendarValue,
} from "../model/target-calendar.js";
import type {
  TargetGrammar2Capability,
} from "../parser/document-parser.js";
import {
  validateTargetDocument,
  type TargetValidationOptions,
} from "../semantic/target-validator.js";
import type { CheckSummary } from "./check.js";

export interface TargetMilestoneDeadline {
  readonly milestoneId: string;
  readonly deadline: TargetCalendarValue;
}

export interface TargetTaskConstraint {
  readonly taskId: string;
  readonly notBefore: TargetCalendarValue | null;
  readonly deadline: TargetCalendarValue | null;
}

export interface TargetTemporalInputs {
  readonly anchor: TargetCalendarValue | null;
  readonly milestoneDeadlines: readonly TargetMilestoneDeadline[];
  readonly taskConstraints: readonly TargetTaskConstraint[];
}

export interface TargetCheckResult {
  readonly ok: boolean;
  readonly document: DocumentNode;
  readonly documentId: string | null;
  readonly grammarVersion: number | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
  readonly summary: CheckSummary;
  readonly temporalInputs: TargetTemporalInputs | null;
}

export interface TargetCheckOptions extends TargetValidationOptions {}

interface OptionalCalendarField {
  readonly present: boolean;
  readonly value: TargetCalendarValue | null;
}

function optionalCalendarField(
  declaration: DeclarationNode,
  name: string,
): OptionalCalendarField {
  const field = fieldNamed(declaration, name);
  return field === undefined
    ? { present: false, value: null }
    : {
        present: true,
        value: projectDeclaredCalendarValue(field.value),
      };
}

function temporalInputsFromDocument(
  document: DocumentNode,
): TargetTemporalInputs | null {
  const project = document.declarations.find(
    (declaration) => declaration.kind === "project",
  );
  const anchor = project === undefined
    ? { present: false, value: null }
    : optionalCalendarField(project, "as_of");
  if (anchor.present && anchor.value === null) return null;

  const milestoneDeadlines: TargetMilestoneDeadline[] = [];
  const taskConstraints: TargetTaskConstraint[] = [];
  for (const declaration of document.declarations) {
    if (declaration.kind === "milestone") {
      const deadline = optionalCalendarField(declaration, "deadline");
      if (!deadline.present) continue;
      if (deadline.value === null) return null;
      milestoneDeadlines.push({
        milestoneId: declaration.id,
        deadline: deadline.value,
      });
      continue;
    }
    if (declaration.kind !== "task") continue;
    const notBefore = optionalCalendarField(declaration, "not_before");
    const deadline = optionalCalendarField(declaration, "deadline");
    if (!notBefore.present && !deadline.present) continue;
    if (
      (notBefore.present && notBefore.value === null) ||
      (deadline.present && deadline.value === null)
    ) {
      return null;
    }
    taskConstraints.push({
      taskId: declaration.id,
      notBefore: notBefore.value,
      deadline: deadline.value,
    });
  }

  return {
    anchor: anchor.value,
    milestoneDeadlines,
    taskConstraints,
  };
}

export function checkTargetDocument(
  text: string,
  capability: TargetGrammar2Capability,
  options: TargetCheckOptions = {},
): TargetCheckResult {
  const checked = validateTargetDocument(text, capability, options);
  const parseFailed = checked.parseFailed;
  const declarations = checked.document.declarations;
  const summary: CheckSummary = {
    resources: parseFailed
      ? 0
      : declarations.filter(({ kind }) => kind === "resource").length,
    milestones: parseFailed
      ? 0
      : declarations.filter(({ kind }) => kind === "milestone").length,
    tasks: parseFailed
      ? 0
      : declarations.filter(({ kind }) => kind === "task").length,
    gates: parseFailed
      ? 0
      : declarations.filter(({ kind }) => kind === "gate").length,
    errors: checked.diagnosticCounts.errors,
    warnings: checked.diagnosticCounts.warnings,
  };
  return {
    ok: checked.ok,
    document: checked.document,
    documentId: checked.documentId,
    grammarVersion: checked.grammarVersion,
    diagnostics: checked.diagnostics,
    diagnosticsTruncated: checked.diagnosticsTruncated,
    summary,
    temporalInputs: parseFailed
      ? null
      : temporalInputsFromDocument(checked.document),
  };
}
