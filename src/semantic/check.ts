import type { Diagnostic } from "../model/diagnostics.js";
import {
  countDiagnostics,
  hasErrors,
  limitDiagnostics,
  normalizeMaxDiagnostics,
} from "../model/diagnostics.js";
import type { DocumentNode } from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import type { TargetCalendarValue } from "../model/target-calendar.js";
import { parseDocument } from "../parser/document-parser.js";
import { validateDocument } from "../semantic/validator.js";
import {
  projectDeclaredCalendarValue,
} from "../model/target-calendar.js";
import {
  projectActualsSourceModel,
  type ProjectActualsSourceModel,
} from "../actuals/source.js";
import {
  validateStoredLifecycleState,
} from "../actuals/lifecycle.js";
import {
  TARGET_GRAMMAR_5_CAPABILITY,
} from "../parser/document-parser.js";
import {
  validateTargetGrammar5Document,
} from "../semantic/target-validator.js";

export interface CheckSummary {
  readonly resources: number;
  readonly milestones: number;
  readonly tasks: number;
  readonly gates: number;
  readonly errors: number;
  readonly warnings: number;
}

export interface MilestoneDeadlineInput {
  readonly milestoneId: string;
  readonly deadline: TargetCalendarValue;
}

export interface TaskTemporalConstraint {
  readonly taskId: string;
  readonly notBefore: TargetCalendarValue | null;
  readonly deadline: TargetCalendarValue | null;
}

export interface TemporalInputs {
  readonly anchor: TargetCalendarValue | null;
  readonly milestoneDeadlines: readonly MilestoneDeadlineInput[];
  readonly taskConstraints: readonly TaskTemporalConstraint[];
}

export interface CheckResult {
  readonly schemaVersion: "Perttool.CheckResult.v3";
  readonly ok: boolean;
  readonly document: DocumentNode;
  readonly documentId: string | null;
  readonly grammarVersion: number | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
  readonly summary: CheckSummary;
  readonly temporalInputs: TemporalInputs | null;
  readonly actualsInputs: ProjectActualsSourceModel | null;
}

export interface CheckOptions {
  readonly maxDiagnostics?: number;
}

function temporalInputs(
  document: DocumentNode,
  parseFailed: boolean,
): TemporalInputs | null {
  if (parseFailed) return null;
  const project = document.declarations.find(
    (declaration) => declaration.kind === "project",
  );
  const anchorField = project === undefined
    ? undefined
    : fieldNamed(project, "as_of");
  const anchor = anchorField === undefined
    ? null
    : projectDeclaredCalendarValue(anchorField.value);
  if (anchorField !== undefined && anchor === null) return null;

  const milestoneDeadlines: MilestoneDeadlineInput[] = [];
  const taskConstraints: TaskTemporalConstraint[] = [];
  for (const declaration of document.declarations) {
    if (declaration.kind === "milestone") {
      const deadlineField = fieldNamed(declaration, "deadline");
      if (deadlineField === undefined) continue;
      const deadline = projectDeclaredCalendarValue(deadlineField.value);
      if (deadline === null) return null;
      milestoneDeadlines.push({ milestoneId: declaration.id, deadline });
      continue;
    }
    if (declaration.kind !== "task") continue;
    const notBeforeField = fieldNamed(declaration, "not_before");
    const deadlineField = fieldNamed(declaration, "deadline");
    if (notBeforeField === undefined && deadlineField === undefined) continue;
    const notBefore = notBeforeField === undefined
      ? null
      : projectDeclaredCalendarValue(notBeforeField.value);
    const deadline = deadlineField === undefined
      ? null
      : projectDeclaredCalendarValue(deadlineField.value);
    if (
      (notBeforeField !== undefined && notBefore === null) ||
      (deadlineField !== undefined && deadline === null)
    ) {
      return null;
    }
    taskConstraints.push({
      taskId: declaration.id,
      notBefore,
      deadline,
    });
  }
  return { anchor, milestoneDeadlines, taskConstraints };
}

export function checkDocument(
  text: string,
  options: CheckOptions = {},
): CheckResult {
  const maxDiagnostics = normalizeMaxDiagnostics(options.maxDiagnostics);
  const parsed = parseDocument(text, { maxDiagnostics });
  const semanticDiagnostics = validateDocument(
    parsed.document,
    parsed.diagnostics,
  );
  const target = validateTargetGrammar5Document(
    text,
    TARGET_GRAMMAR_5_CAPABILITY,
    { maxDiagnostics },
  );
  const lifecycleDiagnostics =
    target.ok && target.validatedDocument !== null
      ? validateStoredLifecycleState(target.validatedDocument)
      : [];
  const validatedDiagnostics = [
    ...semanticDiagnostics,
    ...lifecycleDiagnostics,
  ];
  const limited = limitDiagnostics(validatedDiagnostics, maxDiagnostics);
  const diagnostics = limited.diagnostics;
  const parseFailed = parsed.diagnostics.some(
    (diagnostic) => diagnostic.severity === "error",
  );
  const diagnosticCounts = parseFailed
    ? parsed.diagnosticCounts
    : countDiagnostics(validatedDiagnostics);
  const project = parsed.document.declarations.find(
    (declaration) => declaration.kind === "project",
  );
  const version = project === undefined ? undefined : fieldNamed(project, "version")?.value;
  const summary: CheckSummary = {
    resources: parseFailed
      ? 0
      : parsed.document.declarations.filter((declaration) => declaration.kind === "resource").length,
    milestones: parseFailed
      ? 0
      : parsed.document.declarations.filter((declaration) => declaration.kind === "milestone").length,
    tasks: parseFailed
      ? 0
      : parsed.document.declarations.filter((declaration) => declaration.kind === "task").length,
    gates: parseFailed
      ? 0
      : parsed.document.declarations.filter((declaration) => declaration.kind === "gate").length,
    errors: diagnosticCounts.errors,
    warnings: diagnosticCounts.warnings,
  };
  return {
    schemaVersion: "Perttool.CheckResult.v3",
    ok: !hasErrors(validatedDiagnostics),
    document: parsed.document,
    documentId: project?.id ?? null,
    grammarVersion: parseFailed ? null : typeof version === "number" ? version : 1,
    diagnostics,
    diagnosticsTruncated: parsed.diagnosticsTruncated || limited.truncated,
    summary,
    temporalInputs: temporalInputs(parsed.document, parseFailed),
    actualsInputs:
      target.ok && target.validatedDocument !== null
        ? projectActualsSourceModel(target.validatedDocument)
        : null,
  };
}
