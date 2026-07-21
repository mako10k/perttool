import type { Diagnostic } from "../model/diagnostics.js";
import { hasErrors } from "../model/diagnostics.js";
import type { DocumentNode } from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import { parseDocument } from "../parser/document-parser.js";
import { validateDocument } from "../semantic/validator.js";

export interface CheckSummary {
  readonly resources: number;
  readonly milestones: number;
  readonly tasks: number;
  readonly gates: number;
  readonly errors: number;
  readonly warnings: number;
}

export interface CheckResult {
  readonly ok: boolean;
  readonly document: DocumentNode;
  readonly documentId: string | null;
  readonly grammarVersion: number | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly summary: CheckSummary;
}

export function checkDocument(text: string): CheckResult {
  const parsed = parseDocument(text);
  const diagnostics = validateDocument(parsed.document, parsed.diagnostics);
  const parseFailed = parsed.diagnostics.some(
    (diagnostic) => diagnostic.severity === "error",
  );
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
    errors: diagnostics.filter((diagnostic) => diagnostic.severity === "error").length,
    warnings: diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length,
  };
  return {
    ok: !hasErrors(diagnostics),
    document: parsed.document,
    documentId: project?.id ?? null,
    grammarVersion: parseFailed ? null : typeof version === "number" ? version : 1,
    diagnostics,
    summary,
  };
}
