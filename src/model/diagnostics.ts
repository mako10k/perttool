export type DiagnosticSeverity = "error" | "warning" | "info";

export const DEFAULT_MAX_DIAGNOSTICS = 100;
export const MAX_DIAGNOSTICS_LIMIT = 1000;

export interface SourcePosition {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
}

export interface SourceSpan {
  readonly start: SourcePosition;
  readonly end: SourcePosition;
}

export interface RelatedLocation {
  readonly message: string;
  readonly span: SourceSpan;
}

export interface Diagnostic {
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly entityId?: string;
  readonly span?: SourceSpan;
  readonly related?: readonly RelatedLocation[];
  readonly helpTopic?: string;
  readonly expectedSyntax?: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface LimitedDiagnostics {
  readonly diagnostics: readonly Diagnostic[];
  readonly truncated: boolean;
}

export interface DiagnosticCounts {
  readonly errors: number;
  readonly warnings: number;
  readonly info: number;
}

export function countDiagnostics(
  diagnostics: readonly Diagnostic[],
): DiagnosticCounts {
  return {
    errors: diagnostics.filter(({ severity }) => severity === "error").length,
    warnings: diagnostics.filter(({ severity }) => severity === "warning").length,
    info: diagnostics.filter(({ severity }) => severity === "info").length,
  };
}

export function normalizeMaxDiagnostics(value: number | undefined): number {
  const normalized = value ?? DEFAULT_MAX_DIAGNOSTICS;
  if (
    !Number.isSafeInteger(normalized) ||
    normalized < 1 ||
    normalized > MAX_DIAGNOSTICS_LIMIT
  ) {
    throw new RangeError(
      `maxDiagnostics must be an integer from 1 to ${MAX_DIAGNOSTICS_LIMIT}`,
    );
  }
  return normalized;
}

export function limitDiagnostics(
  diagnostics: readonly Diagnostic[],
  maximum: number,
): LimitedDiagnostics {
  const normalized = normalizeMaxDiagnostics(maximum);
  return {
    diagnostics: diagnostics.slice(0, normalized),
    truncated: diagnostics.length > normalized,
  };
}

const severityRank: Readonly<Record<DiagnosticSeverity, number>> = {
  error: 0,
  warning: 1,
  info: 2,
};

export function sortDiagnostics(
  diagnostics: readonly Diagnostic[],
): readonly Diagnostic[] {
  return [...diagnostics].sort((left, right) => {
    const leftOffset = left.span?.start.offset ?? Number.MAX_SAFE_INTEGER;
    const rightOffset = right.span?.start.offset ?? Number.MAX_SAFE_INTEGER;
    return (
      leftOffset - rightOffset ||
      severityRank[left.severity] - severityRank[right.severity] ||
      compareStableStrings(left.code, right.code) ||
      compareStableStrings(left.entityId ?? "", right.entityId ?? "")
    );
  });
}

export function compareStableStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}
