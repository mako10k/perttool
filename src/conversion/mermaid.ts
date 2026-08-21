import { sha256DigestUtf8 } from "../model/sha256.js";
import type { AnalysisMode, AnalysisResult } from "../analysis/service.js";
import { analyzeDocument } from "../analysis/service.js";
import { checkDocument } from "../semantic/check.js";
import { computeEffectiveReached } from "../analysis/graph.js";
import type { Diagnostic, SourceSpan } from "../model/diagnostics.js";
import { compareStableStrings } from "../model/diagnostics.js";
import type {
  DeclarationNode,
  DocumentNode,
  DurationValue,
  RequirementValue,
  VelocityValue,
} from "../model/syntax.js";
import { rationalFromDuration } from "../model/rational.js";
import { serializeCanonicalVelocitySourceToken } from "../model/exact-velocity-source.js";
import { fieldNamed } from "../model/syntax.js";
import { divide, formatDecimal } from "../model/rational.js";
import { durationSuffix } from "../model/units.js";

export type MermaidProfile = "perttool" | "plain";
export type MermaidAnalysisMode = "none" | AnalysisMode;

export interface MermaidExportOptions {
  readonly profile?: MermaidProfile;
  readonly analysis?: MermaidAnalysisMode;
  readonly capacityOverrides?: ReadonlyMap<string, number>;
  readonly maxDiagnostics?: number;
}

export interface ConversionLoss {
  readonly code: string;
  readonly severity: "warning";
  readonly message: string;
  readonly elementId: string | null;
  readonly span: SourceSpan | null;
  readonly lossy: boolean;
}

export interface ConversionLossReport {
  readonly lossless: boolean;
  readonly records: readonly ConversionLoss[];
}

export interface MermaidExportResult {
  readonly ok: boolean;
  readonly document: DocumentNode;
  readonly documentId: string | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
  readonly profile: MermaidProfile;
  readonly analysis: MermaidAnalysisMode;
  readonly capacityOverrides: ReadonlyMap<string, number>;
  readonly artifact: string | null;
  readonly artifactDigest: string | null;
  readonly lossReport: ConversionLossReport;
}

interface SemanticRecord {
  readonly kind: "project" | "resource" | "milestone" | "task" | "gate";
  readonly value: Readonly<Record<string, unknown>>;
}

function sha256(text: string): string {
  return sha256DigestUtf8(text);
}

function decodedString(
  declaration: DeclarationNode,
  field: string,
): string | null {
  return (fieldNamed(declaration, field)?.value as string | undefined) ?? null;
}

function requiredString(declaration: DeclarationNode, field: string): string {
  return fieldNamed(declaration, field)!.value as string;
}

function canonicalDecimal(value: DurationValue): string {
  if (value.digits === 0n) return "0";
  const raw = value.digits.toString().padStart(value.scale + 1, "0");
  if (value.scale === 0) return raw;
  const whole = raw.slice(0, -value.scale);
  const fraction = raw.slice(-value.scale).replace(/0+$/, "");
  return fraction === "" ? whole : `${whole}.${fraction}`;
}

function canonicalDuration(value: DurationValue): string {
  return `${canonicalDecimal(value)}${value.suffix}`;
}

function canonicalVelocity(value: VelocityValue): string {
  const rate = divide(
    rationalFromDuration(value.points),
    rationalFromDuration(value.period),
  );
  const token = serializeCanonicalVelocitySourceToken(
    rate,
    value.period.suffix === "d" ? "day" : "hour",
  );
  if (token === null) throw new Error("validated velocity must be positive");
  return token;
}

function durationField(
  declaration: DeclarationNode,
  field: string,
): DurationValue | null {
  return (fieldNamed(declaration, field)?.value as DurationValue | undefined) ?? null;
}

function stringList(declaration: DeclarationNode, field: string): readonly string[] {
  return (fieldNamed(declaration, field)?.value as readonly string[] | undefined) ?? [];
}

function projectRecord(
  declaration: DeclarationNode,
): SemanticRecord {
  const unit = requiredString(declaration, "duration_unit");
  const velocity = fieldNamed(declaration, "velocity")?.value as VelocityValue | undefined;
  const epsilon = durationField(declaration, "critical_epsilon");
  const target = durationField(declaration, "target_duration");
  return {
    kind: "project",
    value: {
      id: declaration.id,
      version: (fieldNamed(declaration, "version")?.value as number | undefined) ?? 1,
      title: requiredString(declaration, "title"),
      description: decodedString(declaration, "description"),
      as_of: decodedString(declaration, "as_of"),
      duration_unit: unit,
      velocity: velocity === undefined ? null : canonicalVelocity(velocity),
      finish: requiredString(declaration, "finish"),
      critical_epsilon:
        epsilon === null
          ? `0${unit === "day" ? "d" : unit === "hour" ? "h" : "p"}`
          : canonicalDuration(epsilon),
      target_duration: target === null ? null : canonicalDuration(target),
    },
  };
}

function resourceRecord(declaration: DeclarationNode): SemanticRecord {
  return {
    kind: "resource",
    value: {
      id: declaration.id,
      title: requiredString(declaration, "title"),
      description: decodedString(declaration, "description"),
      capacity: fieldNamed(declaration, "capacity")!.value as number,
      tags: stringList(declaration, "tags"),
    },
  };
}

function milestoneRecord(declaration: DeclarationNode): SemanticRecord {
  return {
    kind: "milestone",
    value: {
      id: declaration.id,
      title: requiredString(declaration, "title"),
      description: decodedString(declaration, "description"),
      state:
        (fieldNamed(declaration, "state")?.value as string | undefined) ?? "planned",
      tags: stringList(declaration, "tags"),
    },
  };
}

function taskEstimate(declaration: DeclarationNode): Readonly<Record<string, unknown>> {
  const duration = durationField(declaration, "duration");
  if (duration !== null) {
    return { kind: "deterministic", duration: canonicalDuration(duration) };
  }
  const children = fieldNamed(declaration, "estimate")!.children!;
  const child = (name: string): string =>
    canonicalDuration(children.find((candidate) => candidate.name === name)!.value as DurationValue);
  return {
    kind: "pert",
    optimistic: child("optimistic"),
    most_likely: child("most_likely"),
    pessimistic: child("pessimistic"),
  };
}

function taskRecord(declaration: DeclarationNode): SemanticRecord {
  const requirements = [
    ...((fieldNamed(declaration, "requires")?.value as readonly RequirementValue[] | undefined) ?? []),
  ].sort((left, right) => compareStableStrings(left.resourceId, right.resourceId));
  return {
    kind: "task",
    value: {
      id: declaration.id,
      from: declaration.from!,
      to: declaration.to!,
      title: requiredString(declaration, "title"),
      description: decodedString(declaration, "description"),
      estimate: taskEstimate(declaration),
      status:
        (fieldNamed(declaration, "status")?.value as string | undefined) ?? "planned",
      priority: (fieldNamed(declaration, "priority")?.value as number | undefined) ?? 0,
      requires: requirements.map((requirement) => ({
        resource_id: requirement.resourceId,
        units: requirement.units,
      })),
      owner: decodedString(declaration, "owner"),
      tags: stringList(declaration, "tags"),
      blocked_reason: decodedString(declaration, "blocked_reason"),
      source: decodedString(declaration, "source"),
    },
  };
}

function gateRecord(declaration: DeclarationNode): SemanticRecord {
  return {
    kind: "gate",
    value: {
      id: declaration.id,
      from: declaration.from!,
      to: declaration.to!,
      reason: requiredString(declaration, "reason"),
    },
  };
}

function recordsFor(document: DocumentNode): readonly SemanticRecord[] {
  const project = document.declarations.find((declaration) => declaration.kind === "project")!;
  const declarations = (kind: DeclarationNode["kind"]): readonly DeclarationNode[] =>
    document.declarations
      .filter((declaration) => declaration.kind === kind)
      .sort((left, right) => compareStableStrings(left.id, right.id));
  return [
    projectRecord(project),
    ...declarations("resource").map(resourceRecord),
    ...declarations("milestone").map(milestoneRecord),
    ...declarations("task").map(taskRecord),
    ...declarations("gate").map(gateRecord),
  ];
}

function escapeLabel(value: string): string {
  const escaped = new Set(["\"", "#", "&", ";", "<", ">", "\\", "|", "`"]);
  let result = "";
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    result += escaped.has(character) || codePoint <= 0x1f || codePoint === 0x7f
      ? `#${codePoint};`
      : character;
  }
  return result;
}

function taskLabel(
  declaration: DeclarationNode,
  analysis: AnalysisResult | null,
  precision: number,
): string {
  const status =
    (fieldNamed(declaration, "status")?.value as string | undefined) ?? "planned";
  const owner = decodedString(declaration, "owner");
  const precedence = analysis?.precedence?.edges.find(
    (edge) => edge.kind === "task" && edge.id === declaration.id,
  );
  const scheduled = analysis?.resource?.tasks.find((task) => task.id === declaration.id);
  const unit = analysis?.durationUnit;
  const parts = [`${declaration.id}: ${requiredString(declaration, "title")}`];
  if (status !== "planned") parts.push(status);
  if (owner !== null) parts.push(`owner=${owner}`);
  const expected = precedence?.expected ?? scheduled?.expected;
  const totalFloat = precedence?.totalFloat ?? scheduled?.priorityKey.precedenceTotalFloat;
  if (expected !== undefined && unit !== null && unit !== undefined) {
    parts.push(`E=${formatDecimal(expected, precision)}${durationSuffix(unit)}`);
  }
  if (totalFloat !== undefined && unit !== null && unit !== undefined) {
    parts.push(`TF=${formatDecimal(totalFloat, precision)}${durationSuffix(unit)}`);
  }
  if (precedence?.isCritical === true) parts.push("CP");
  if (scheduled !== undefined && unit !== null && unit !== undefined) {
    parts.push(
      `S=${formatDecimal(scheduled.start, precision)}-${formatDecimal(scheduled.finish, precision)}${durationSuffix(unit)}`,
    );
  }
  if (analysis?.resource?.scheduleCritical.taskIds.includes(declaration.id) === true) {
    parts.push("SCP");
  }
  return escapeLabel(parts.join(" / "));
}

function taskLinkStyle(
  declaration: DeclarationNode,
  analysis: AnalysisResult | null,
): string {
  const status =
    (fieldNamed(declaration, "status")?.value as string | undefined) ?? "planned";
  if (status === "active") return "stroke:#2471a3,stroke-width:4px";
  if (status === "blocked") {
    return "stroke:#d68910,stroke-width:3px,stroke-dasharray:5 5";
  }
  if (status === "done") return "stroke:#95a5a6,stroke-width:2px";
  const precedenceCritical = analysis?.precedence?.critical.taskIds.includes(declaration.id) === true;
  const scheduleCritical = analysis?.resource?.scheduleCritical.taskIds.includes(declaration.id) === true;
  return precedenceCritical || scheduleCritical
    ? "stroke:#c0392b,stroke-width:4px"
    : "stroke:#34495e,stroke-width:2px";
}

export function renderMermaidProjection(
  document: DocumentNode,
  analysis: AnalysisResult | null,
  precision = 3,
): readonly string[] {
  const milestones = document.declarations
    .filter((declaration) => declaration.kind === "milestone")
    .sort((left, right) => compareStableStrings(left.id, right.id));
  const tasks = document.declarations
    .filter((declaration) => declaration.kind === "task")
    .sort((left, right) => compareStableStrings(left.id, right.id));
  const gates = document.declarations
    .filter((declaration) => declaration.kind === "gate")
    .sort((left, right) => compareStableStrings(left.id, right.id));
  const lines: string[] = [];
  for (const milestone of milestones) {
    lines.push(
      `  ptm_${milestone.id}(("${escapeLabel(`${milestone.id}: ${requiredString(milestone, "title")}`)}"))`,
    );
  }
  for (const task of tasks) {
    lines.push(
      `  ptm_${task.from!} -->|"${taskLabel(task, analysis, precision)}"| ptm_${task.to!}`,
    );
  }
  for (const gate of gates) {
    lines.push(
      `  ptm_${gate.from!} -.->|"${escapeLabel(`${gate.id}: gate`)}"| ptm_${gate.to!}`,
    );
  }
  lines.push(
    "  classDef pt_milestone_planned fill:#ffffff,stroke:#566573,stroke-width:1px;",
    "  classDef pt_milestone_reached fill:#d5f5e3,stroke:#1e8449,stroke-width:2px;",
  );
  const reached = computeEffectiveReached(document);
  const reachedIds = milestones.filter(({ id }) => reached.has(id)).map(({ id }) => `ptm_${id}`);
  const plannedIds = milestones.filter(({ id }) => !reached.has(id)).map(({ id }) => `ptm_${id}`);
  if (plannedIds.length > 0) {
    lines.push(`  class ${plannedIds.join(",")} pt_milestone_planned;`);
  }
  if (reachedIds.length > 0) {
    lines.push(`  class ${reachedIds.join(",")} pt_milestone_reached;`);
  }
  tasks.forEach((task, index) => {
    lines.push(`  linkStyle ${index} ${taskLinkStyle(task, analysis)};`);
  });
  gates.forEach((_, index) => {
    lines.push(
      `  linkStyle ${tasks.length + index} stroke:#7f8c8d,stroke-width:1px,stroke-dasharray:3 3;`,
    );
  });
  return lines;
}

function profileArtifact(
  document: DocumentNode,
  projection: readonly string[],
  analysisMode: MermaidAnalysisMode,
  overrides: ReadonlyMap<string, number>,
): string {
  const records = recordsFor(document);
  const recordBodies = records.map(
    ({ kind, value }) => `${kind} ${JSON.stringify(value)}\n`,
  );
  const projectionBody = projection.map((line) => `${line}\n`).join("");
  const header = {
    schema_version: "Perttool.MermaidProfile.v1",
    profile: "perttool",
    source_fidelity: "semantic-v1",
    record_count: records.length,
    metadata_digest: sha256(recordBodies.join("")),
    projection_digest: sha256(projectionBody),
    projection: {
      schema_version: "Perttool.MermaidProjection.v1",
      direction: "LR",
      analysis: analysisMode,
      capacity_overrides: [...overrides]
        .sort(([left], [right]) => compareStableStrings(left, right))
        .map(([resourceId, capacity]) => ({ resource_id: resourceId, capacity })),
    },
  };
  return [
    "flowchart LR",
    `  %% perttool:profile ${JSON.stringify(header)}`,
    ...records.map(({ kind, value }) => `  %% perttool:${kind} ${JSON.stringify(value)}`),
    "  %% perttool:projection-begin",
    ...projection,
    "  %% perttool:projection-end",
    "",
  ].join("\n");
}

function plainLoss(document: DocumentNode): ConversionLoss {
  const project = document.declarations.find((declaration) => declaration.kind === "project")!;
  return {
    code: "PTCNV-206",
    severity: "warning",
    message: "plain Mermaid profile does not retain lossless semantic metadata",
    elementId: project.id,
    span: project.headerSpan,
    lossy: true,
  };
}

export function exportMermaid(
  text: string,
  options: MermaidExportOptions = {},
): MermaidExportResult {
  const profile = options.profile ?? "perttool";
  const analysisMode = options.analysis ?? "none";
  const capacityOverrides = options.capacityOverrides ?? new Map<string, number>();
  const precision = 3;
  if (
    capacityOverrides.size > 0 &&
    analysisMode !== "resource" &&
    analysisMode !== "both"
  ) {
    throw new RangeError("capacityOverrides require resource or both analysis");
  }
  let analysis: AnalysisResult | null = null;
  let document: DocumentNode;
  let documentId: string | null;
  let diagnostics: readonly Diagnostic[];
  let diagnosticsTruncated: boolean;
  let ok: boolean;

  if (analysisMode === "none") {
    const checked = checkDocument(text, {
      ...(options.maxDiagnostics === undefined
        ? {}
        : { maxDiagnostics: options.maxDiagnostics }),
    });
    document = checked.document;
    documentId = checked.documentId;
    diagnostics = checked.diagnostics;
    diagnosticsTruncated = checked.diagnosticsTruncated;
    ok = checked.ok;
  } else {
    analysis = analyzeDocument(text, {
      mode: analysisMode,
      capacityOverrides,
      precision,
      ...(options.maxDiagnostics === undefined
        ? {}
        : { maxDiagnostics: options.maxDiagnostics }),
    });
    document = analysis.document;
    documentId = analysis.documentId;
    diagnostics = analysis.diagnostics;
    diagnosticsTruncated = analysis.diagnosticsTruncated;
    ok = analysis.ok;
  }

  if (!ok) {
    return {
      ok,
      document,
      documentId,
      diagnostics,
      diagnosticsTruncated,
      profile,
      analysis: analysisMode,
      capacityOverrides,
      artifact: null,
      artifactDigest: null,
      lossReport: { lossless: false, records: [] },
    };
  }

  const project = document.declarations.find(
    ({ kind }) => kind === "project",
  );
  if (
    profile === "perttool" &&
    fieldNamed(project!, "version")?.value === 4
  ) {
    return {
      ok: false,
      document,
      documentId,
      diagnostics: [
        ...diagnostics,
        {
          code: "PTCNV-102",
          severity: "error",
          message:
            "Mermaid Profile v1 cannot preserve Grammar 4 governance metadata",
          span: project!.headerSpan,
          entityId: project!.id,
          helpTopic: "mermaid",
        },
      ],
      diagnosticsTruncated,
      profile,
      analysis: analysisMode,
      capacityOverrides,
      artifact: null,
      artifactDigest: null,
      lossReport: { lossless: false, records: [] },
    };
  }

  const projection = renderMermaidProjection(document, analysis, precision);
  const artifact = profile === "perttool"
    ? profileArtifact(document, projection, analysisMode, capacityOverrides)
    : ["flowchart LR", ...projection, ""].join("\n");
  const records = profile === "plain" ? [plainLoss(document)] : [];
  return {
    ok,
    document,
    documentId,
    diagnostics,
    diagnosticsTruncated,
    profile,
    analysis: analysisMode,
    capacityOverrides,
    artifact,
    artifactDigest: sha256(artifact),
    lossReport: { lossless: records.length === 0, records },
  };
}
