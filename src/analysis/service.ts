import type { Diagnostic, RelatedLocation } from "../model/diagnostics.js";
import {
  hasErrors,
  limitDiagnostics,
  normalizeMaxDiagnostics,
  sortDiagnostics,
} from "../model/diagnostics.js";
import { fieldNamed } from "../model/syntax.js";
import type { DocumentNode, RequirementValue } from "../model/syntax.js";
import { buildResidualGraph } from "../analysis/graph.js";
import type { ResidualGraph } from "../analysis/graph.js";
import { analyzePrecedence } from "../analysis/precedence.js";
import type { PrecedenceResult } from "../analysis/precedence.js";
import { analyzeResources } from "../analysis/resource.js";
import type { ResourceScheduleResult } from "../analysis/resource.js";
import type { Rational } from "../model/rational.js";
import type { DurationUnit, Velocity, VelocityConversion } from "../model/units.js";
import { createVelocityConversion } from "../model/units.js";
import { checkDocument } from "../semantic/check.js";

export type AnalysisMode = "precedence" | "resource" | "both";

export interface AnalyzeOptions {
  readonly mode?: AnalysisMode;
  readonly capacityOverrides?: ReadonlyMap<string, number>;
  readonly maxPaths?: number;
  readonly precision?: number;
  readonly maxDiagnostics?: number;
}

export interface AnalysisResult {
  readonly ok: boolean;
  readonly document: DocumentNode;
  readonly documentId: string | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
  readonly mode: AnalysisMode;
  readonly precision: number;
  readonly capacityOverrides: ReadonlyMap<string, number>;
  readonly durationUnit: DurationUnit | null;
  readonly velocity: Velocity | null;
  readonly velocityForecast: VelocityConversion | null;
  readonly criticalEpsilon: Rational | null;
  readonly precedence: PrecedenceResult | null;
  readonly resource: ResourceScheduleResult | null;
}

function diagnostic(
  code: string,
  severity: "error" | "warning",
  message: string,
  entityId?: string,
  related?: readonly RelatedLocation[],
  helpTopic = "analysis.resources",
): Diagnostic {
  return {
    code,
    severity,
    message,
    helpTopic,
    ...(entityId === undefined ? {} : { entityId }),
    ...(related === undefined || related.length === 0 ? {} : { related }),
  };
}

function validateCapacityOverrides(
  graph: ResidualGraph,
  overrides: ReadonlyMap<string, number>,
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const [id] of overrides) {
    if (!graph.resources.has(id)) {
      diagnostics.push(
        diagnostic("PTSEM-206", "error", `resource ${id} in capacity override is undefined`, id),
      );
    }
  }
  if (hasErrors(diagnostics)) return diagnostics;
  const effective = new Map(
    [...graph.resources].map(([id, resource]) => [id, overrides.get(id) ?? resource.capacity]),
  );
  for (const declaration of graph.document.declarations.filter((candidate) => candidate.kind === "task")) {
    const requirements = (fieldNamed(declaration, "requires")?.value ?? []) as readonly RequirementValue[];
    for (const requirement of requirements) {
      if (requirement.units > effective.get(requirement.resourceId)!) {
        diagnostics.push({
          code: "PTSEM-208",
          severity: "error",
          message: `requirement ${requirement.units} exceeds what-if capacity ${effective.get(requirement.resourceId)!}`,
          entityId: declaration.id,
          span: requirement.unitsSpan,
          helpTopic: "analysis.resources",
        });
      }
    }
  }
  for (const [id, resource] of graph.resources) {
    const activeTasks = graph.document.declarations.filter(
      (declaration) =>
        declaration.kind === "task" && fieldNamed(declaration, "status")?.value === "active",
    );
    const usage = activeTasks.reduce((sum, task) => {
      const requirements = (fieldNamed(task, "requires")?.value ?? []) as readonly RequirementValue[];
      return sum + (requirements.find((requirement) => requirement.resourceId === id)?.units ?? 0);
    }, 0);
    if (usage > effective.get(id)!) {
      diagnostics.push({
        code: "PTRES-202",
        severity: "error",
        message: `what-if capacity ${effective.get(id)!} is less than active usage ${usage}`,
        entityId: id,
        span: fieldNamed(resource.declaration, "capacity")!.valueSpan,
        helpTopic: "analysis.resources",
        related: activeTasks
          .filter((task) => {
            const requirements = (fieldNamed(task, "requires")?.value ?? []) as readonly RequirementValue[];
            return requirements.some((requirement) => requirement.resourceId === id);
          })
          .map((task) => ({ message: `active task ${task.id}`, span: task.idSpan })),
      });
    }
  }
  return diagnostics;
}

export function analyzeValidatedDocument(
  document: DocumentNode,
  documentId: string,
  initialDiagnostics: readonly Diagnostic[],
  diagnosticsAlreadyTruncated: boolean,
  options: AnalyzeOptions = {},
): AnalysisResult {
  const mode = options.mode ?? "both";
  const maxPaths = options.maxPaths ?? 1;
  const precision = options.precision ?? 3;
  const maxDiagnostics = normalizeMaxDiagnostics(options.maxDiagnostics);
  const overrides = options.capacityOverrides ?? new Map<string, number>();
  const diagnostics: Diagnostic[] = [...initialDiagnostics];
  const graph = buildResidualGraph(document);
  diagnostics.push(...validateCapacityOverrides(graph, overrides));
  if (hasErrors(diagnostics)) {
    const limited = limitDiagnostics(sortDiagnostics(diagnostics), maxDiagnostics);
    return {
      ok: false,
      document,
      documentId,
      diagnostics: limited.diagnostics,
      diagnosticsTruncated:
        diagnosticsAlreadyTruncated || limited.truncated,
      mode,
      precision,
      capacityOverrides: overrides,
      durationUnit: graph.durationUnit,
      velocity: graph.velocity,
      velocityForecast: createVelocityConversion(
        graph.durationUnit,
        graph.velocity,
      ),
      criticalEpsilon: graph.criticalEpsilon,
      precedence: null,
      resource: null,
    };
  }
  const internalPrecedence = analyzePrecedence(graph, maxPaths);
  const resource =
    mode === "precedence"
      ? null
      : analyzeResources(graph, internalPrecedence, overrides, maxPaths);
  const precedence = mode === "resource" ? null : internalPrecedence;
  if (
    precedence?.critical.pathsTruncated === true ||
    resource?.scheduleCritical.pathsTruncated === true
  ) {
    diagnostics.push(
      diagnostic(
        "PTDAG-302",
        "warning",
        `critical path enumeration was truncated at max-paths ${maxPaths}`,
        undefined,
        undefined,
        "analysis",
      ),
    );
  }
  if (resource?.conditionalOnBlocksResolved === true) {
    diagnostics.push(
      diagnostic(
        "PTRES-303",
        "warning",
        "resource schedule is conditional on blocked tasks being resolved at time 0",
        resource.blockedTaskIds[0],
      ),
    );
  }
  const limited = limitDiagnostics(sortDiagnostics(diagnostics), maxDiagnostics);
  return {
    ok: !hasErrors(diagnostics),
    document,
    documentId,
    diagnostics: limited.diagnostics,
    diagnosticsTruncated:
      diagnosticsAlreadyTruncated || limited.truncated,
    mode,
    precision,
    capacityOverrides: overrides,
    durationUnit: graph.durationUnit,
    velocity: graph.velocity,
    velocityForecast: createVelocityConversion(
      graph.durationUnit,
      graph.velocity,
    ),
    criticalEpsilon: graph.criticalEpsilon,
    precedence,
    resource,
  };
}

export function analyzeDocument(
  text: string,
  options: AnalyzeOptions = {},
): AnalysisResult {
  const mode = options.mode ?? "both";
  const precision = options.precision ?? 3;
  const maxDiagnostics = normalizeMaxDiagnostics(options.maxDiagnostics);
  const overrides = options.capacityOverrides ?? new Map<string, number>();
  const checked = checkDocument(text, { maxDiagnostics });
  const diagnostics: Diagnostic[] = [...checked.diagnostics];
  if (!checked.ok) {
    return {
      ok: false,
      document: checked.document,
      documentId: checked.documentId,
      diagnostics,
      diagnosticsTruncated: checked.diagnosticsTruncated,
      mode,
      precision,
      capacityOverrides: overrides,
      durationUnit: null,
      velocity: null,
      velocityForecast: null,
      criticalEpsilon: null,
      precedence: null,
      resource: null,
    };
  }
  return analyzeValidatedDocument(
    checked.document,
    checked.documentId!,
    diagnostics,
    checked.diagnosticsTruncated,
    options,
  );
}
