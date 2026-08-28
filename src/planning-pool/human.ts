import type { PlanningPoolHistoricalObservationResult } from "./history-types.js";
import type {
  PlanningPoolObservationResult,
  PlanningWorkObservation,
} from "./observation-types.js";
import type { PlanningPoolReadResult } from "./public-core.js";
import type {
  PlanningReshapeDescriptionRow,
  PlanningReshapePreflightResult,
} from "./reshape-types.js";

const NONE = "(none)";

function joined(values: readonly string[]): string {
  return values.length === 0 ? NONE : values.join(", ");
}

function yesNo(value: boolean): "yes" | "no" {
  return value ? "yes" : "no";
}

function heading(lines: string[], title: string): void {
  if (lines.length > 0) lines.push("");
  lines.push(title);
}

function multilineField(lines: string[], label: string, value: string | null): void {
  if (value === null || value === "") {
    lines.push(`${label}: ${NONE}`);
    return;
  }
  const parts = value.split("\n");
  if (parts.length === 1) {
    lines.push(`${label}: ${value}`);
    return;
  }
  lines.push(`${label}:`);
  lines.push(...parts.map((part) => `  ${part}`));
}

function renderWorkList(result: PlanningPoolReadResult): string {
  const order = new Map(result.workOrder.map((id, index) => [id, index]));
  return [...result.works]
    .sort((left, right) =>
      (order.get(left.qualifiedId) ?? 0) - (order.get(right.qualifiedId) ?? 0)
    )
    .map((work) => `${work.qualifiedId}\t${work.title}\n`)
    .join("");
}

function renderWindowList(result: PlanningPoolReadResult): string {
  return result.windows
    .map((window) =>
      `${window.qualifiedId}\t${window.title}\t${window.objective}\n`
    )
    .join("");
}

function renderEventList(result: PlanningPoolReadResult): string {
  return result.events
    .map((event) => `${event.qualifiedId}\t${event.title}\n`)
    .join("");
}

function renderActivityList(result: PlanningPoolReadResult): string {
  return result.activities
    .map((activity) =>
      `${activity.qualifiedId}\t${activity.from.qualifiedId} -> ${activity.to.qualifiedId}\t${activity.title}\n`
    )
    .join("");
}

function renderWorkShow(result: PlanningPoolReadResult): string {
  const work = result.works[0];
  if (work === undefined) return "";
  const lines = [`WORK ${work.qualifiedId}`, `Title: ${work.title}`];
  multilineField(lines, "Description", work.description?.value ?? null);

  heading(lines, "PLANNING");
  lines.push(
    `Events: ${joined(work.events.map(({ qualifiedId }) => qualifiedId))}`,
    `Activities: ${joined(work.activities.map(({ qualifiedId }) => qualifiedId))}`,
  );

  heading(lines, "STRICT LINKS");
  lines.push(
    `Milestones: ${joined(work.milestoneLinks.map(({ qualifiedId }) => qualifiedId))}`,
    `Tasks: ${joined(work.taskLinks.map(({ qualifiedId }) => qualifiedId))}`,
  );

  const rank = result.workOrder.indexOf(work.qualifiedId);
  heading(lines, "ORGANIZATION");
  lines.push(
    `Global order: ${rank < 0 ? NONE : `${rank + 1} of ${result.workOrder.length}`}`,
    `Previous Work: ${rank > 0 ? result.workOrder[rank - 1] : NONE}`,
    `Next Work: ${rank >= 0 && rank + 1 < result.workOrder.length ? result.workOrder[rank + 1] : NONE}`,
    `Depends on: ${joined(work.dependsOn.map(({ qualifiedId }) => qualifiedId))}`,
    `Windows: ${joined(result.windows.map(({ qualifiedId }) => qualifiedId))}`,
  );
  return `${lines.join("\n")}\n`;
}

function renderWindowShow(result: PlanningPoolReadResult): string {
  const window = result.windows[0];
  if (window === undefined) return "";
  const order = new Map(result.workOrder.map((id, index) => [id, index]));
  const selected = [...window.works].sort((left, right) =>
    (order.get(left.qualifiedId) ?? Number.MAX_SAFE_INTEGER) -
    (order.get(right.qualifiedId) ?? Number.MAX_SAFE_INTEGER)
  );
  const lines = [
    `WINDOW ${window.qualifiedId}`,
    `Title: ${window.title}`,
  ];
  multilineField(lines, "Objective", window.objective);

  heading(lines, "IDENTITY");
  lines.push(
    `Document: ${result.documentId ?? NONE}`,
    "Kind: persisted",
  );

  heading(lines, "BOUNDS");
  lines.push(
    `Start: ${window.start?.sourceText ?? NONE}`,
    `End: ${window.end?.sourceText ?? NONE}`,
    "Interval: half-open [start, end)",
  );

  heading(lines, "SELECTED WORK");
  if (selected.length === 0) lines.push(NONE);
  for (const work of selected) {
    const rank = order.get(work.qualifiedId);
    lines.push(
      `${work.qualifiedId}  global_order=${rank === undefined ? NONE : rank + 1}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

function associatedWorkIds(result: PlanningPoolReadResult): readonly string[] {
  const order = new Map(result.workOrder.map((id, index) => [id, index]));
  return Object.freeze([...result.works]
    .sort((left, right) =>
      (order.get(left.qualifiedId) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(right.qualifiedId) ?? Number.MAX_SAFE_INTEGER)
    )
    .map(({ qualifiedId }) => qualifiedId));
}

function renderEventShow(result: PlanningPoolReadResult): string {
  const event = result.events[0];
  if (event === undefined) return "";
  const lines = [`EVENT ${event.qualifiedId}`, `Title: ${event.title}`];
  multilineField(lines, "Description", event.description?.value ?? null);

  heading(lines, "IDENTITY");
  lines.push(
    `Document: ${result.documentId ?? NONE}`,
    "Owner: project",
    "Kind: Temporary Draft Event",
  );

  heading(lines, "ASSOCIATED WORK");
  lines.push(joined(associatedWorkIds(result)));

  heading(lines, "METADATA");
  lines.push(
    `Tags: ${joined(event.tags)}`,
    `Source: ${event.source ?? NONE}`,
  );
  return `${lines.join("\n")}\n`;
}

function renderActivityShow(result: PlanningPoolReadResult): string {
  const activity = result.activities[0];
  if (activity === undefined) return "";
  const lines = [`ACTIVITY ${activity.qualifiedId}`, `Title: ${activity.title}`];
  multilineField(lines, "Description", activity.description?.value ?? null);

  heading(lines, "IDENTITY");
  lines.push(
    `Document: ${result.documentId ?? NONE}`,
    "Owner: project",
    "Kind: Temporary Draft Activity",
  );

  heading(lines, "ENDPOINTS");
  lines.push(
    `From: ${activity.from.qualifiedId}`,
    `To: ${activity.to.qualifiedId}`,
  );

  heading(lines, "PLAN");
  lines.push(
    `Duration: ${activity.duration?.sourceText ?? NONE}`,
    `Estimate: ${activity.estimate === null
      ? NONE
      : `${activity.estimate.optimistic.sourceText} / ${activity.estimate.mostLikely.sourceText} / ${activity.estimate.pessimistic.sourceText}`}`,
    `Priority: ${activity.priority ?? NONE}`,
    `Calendar: ${activity.calendarId ?? NONE}`,
    `Deadline: ${activity.deadline?.sourceText ?? NONE}`,
  );

  heading(lines, "REQUIREMENTS");
  if (activity.requirements.length === 0) lines.push(NONE);
  for (const requirement of activity.requirements) {
    lines.push(`${requirement.qualifiedResourceId} ${requirement.units}`);
  }

  heading(lines, "TIMING");
  if (activity.when.length === 0) lines.push(NONE);
  for (const bound of activity.when) {
    lines.push(`${bound.event} ${bound.direction}: ${bound.value.sourceText}`);
  }

  heading(lines, "ASSOCIATED WORK");
  lines.push(joined(associatedWorkIds(result)));

  heading(lines, "METADATA");
  lines.push(
    `Plan owner: ${activity.owner ?? NONE}`,
    `Tags: ${joined(activity.tags)}`,
    `Source: ${activity.source ?? NONE}`,
  );
  return `${lines.join("\n")}\n`;
}

export function renderPlanningPoolReadText(result: PlanningPoolReadResult): string {
  if (!result.ok) return "";
  switch (result.operation) {
    case "work.list":
      return renderWorkList(result);
    case "event.list":
      return renderEventList(result);
    case "activity.list":
      return renderActivityList(result);
    case "window.list":
      return renderWindowList(result);
    case "work.show":
      return renderWorkShow(result);
    case "event.show":
      return renderEventShow(result);
    case "activity.show":
      return renderActivityShow(result);
    case "window.show":
      return renderWindowShow(result);
  }
}

function taskLine(task: PlanningWorkObservation["execution"]["tasks"][number]): string {
  return `${task.taskId}  status=${task.status} actuals=${task.actualsCoverage} complete=${yesNo(task.complete)} attribution=${task.attribution}`;
}

function milestoneLine(
  milestone: PlanningWorkObservation["outcome"]["milestones"][number],
): string {
  return `${milestone.milestoneId}  closure=${milestone.closure} acceptance=${milestone.acceptance} evidence_complete=${yesNo(milestone.evidenceComplete)} attribution=${milestone.attribution}`;
}

function renderObservedWork(lines: string[], work: PlanningWorkObservation): void {
  heading(lines, `WORK ${work.workId}`);
  lines.push(`Title: ${work.title}`);

  heading(lines, "REFINEMENT");
  lines.push(
    `Residual description: ${work.refinement.residualDescriptionPresent ? "present" : "absent"}`,
    `Events: ${joined(work.refinement.eventIds)}`,
    `Activities: ${joined(work.refinement.activityIds)}`,
    `Milestone links: ${joined(work.refinement.milestoneLinkIds)}`,
    `Task links: ${joined(work.refinement.taskLinkIds)}`,
    `Uncovered dependencies: ${joined(work.refinement.uncoveredDependencyIds)}`,
  );

  heading(lines, "EXECUTION");
  lines.push(
    `State: ${work.execution.state}`,
    `Activity obligations: ${joined(work.execution.activityObligationIds)}`,
    `Unprojected activities: ${joined(work.execution.unprojectedActivityIds)}`,
    `Tasks: ${work.execution.tasks.length === 0 ? NONE : ""}`.trimEnd(),
  );
  lines.push(...work.execution.tasks.map((task) => `  ${taskLine(task)}`));

  heading(lines, "OUTCOME");
  lines.push(
    `Evidence: ${work.outcome.state}`,
    `Milestones: ${work.outcome.milestones.length === 0 ? NONE : ""}`.trimEnd(),
  );
  lines.push(...work.outcome.milestones.map((milestone) =>
    `  ${milestoneLine(milestone)}`
  ));

  heading(lines, "ORGANIZATION");
  lines.push(
    `Global order: ${work.organization.globalRank + 1}`,
    `Depends on: ${joined(work.organization.dependencyIds)}`,
    `Required by: ${joined(work.organization.dependentIds)}`,
    `Dependency cycles: ${joined(work.organization.dependencyCycleIds)}`,
    `Windows: ${joined(work.organization.windowIds)}`,
    `Trace useful: ${yesNo(work.organization.traceUseful)}`,
    `Archiveable: ${yesNo(work.organization.archiveable)}`,
    `Close disposition: ${work.closeDisposition}`,
  );
}

function selectionText(result: PlanningPoolObservationResult): string {
  const selection = result.normalizedRequest?.selection;
  if (selection === undefined) return NONE;
  switch (selection.kind) {
    case "pool":
      return "planning pool";
    case "work":
      return `Work ${joined(selection.work_ids)}`;
    case "persisted":
      return `Window ${selection.window_id}`;
    case "ad_hoc":
      return "ad hoc Window";
  }
}

function renderTemporal(lines: string[], result: PlanningPoolObservationResult): void {
  heading(lines, "TEMPORAL");
  const window = result.window;
  if (window === null) {
    lines.push("Window: not selected", "Position: not applicable", `Overlaps: ${NONE}`);
    return;
  }
  lines.push(
    `Window: ${window.window.qualifiedId ?? "ad hoc"}`,
    `Bounds: ${window.window.start ?? NONE} .. ${window.window.end ?? NONE}`,
    `Observation: ${window.temporalPosition.observationValue ?? NONE}`,
    `Observation source: ${window.temporalPosition.source ?? NONE}`,
    `Position: ${window.temporalPosition.state}`,
    `Position cause: ${window.temporalPosition.cause ?? NONE}`,
    `Selected execution: ${window.selectedExecution}`,
    `Overlaps: ${window.temporalOverlaps.length === 0 ? NONE : ""}`.trimEnd(),
  );
  lines.push(...window.temporalOverlaps.map((overlap) =>
    `  ${overlap.windowId}  state=${overlap.state} intersection=${overlap.intersectionStart ?? NONE}..${overlap.intersectionEnd ?? NONE} cause=${overlap.cause ?? NONE}`
  ));
}

function renderDiagnostics(
  lines: string[],
  diagnostics: PlanningPoolObservationResult["diagnostics"],
): void {
  heading(lines, "DIAGNOSTICS");
  if (diagnostics.length === 0) {
    lines.push(NONE);
    return;
  }
  lines.push(...diagnostics.map((diagnostic) =>
    `${diagnostic.code} ${diagnostic.severity}: ${diagnostic.message}`
  ));
}

export function renderPlanningObservationText(
  operation: "work.observe" | "window.observe",
  result: PlanningPoolObservationResult,
): string {
  const lines = [
    `${operation === "work.observe" ? "WORK" : "WINDOW"} OBSERVATION`,
    `Document: ${result.documentId ?? NONE}`,
    `Source digest: ${result.sourceDigest}`,
    `Selection: ${selectionText(result)}`,
    `Evidence: ${result.evidence.state} (${result.evidence.mode})`,
    `Selected Work order: ${joined(result.selectedWorkOrder)}`,
  ];
  for (const work of result.works) renderObservedWork(lines, work);
  renderTemporal(lines, result);

  heading(lines, "GLOBAL EXECUTION");
  lines.push(
    `Evidence: ${result.globalExecution.evidenceState}`,
    `Recommended Tasks: ${joined(result.globalExecution.recommendedTaskIds)}`,
    `Startable Tasks: ${joined(result.globalExecution.startableTaskIds)}`,
  );
  renderDiagnostics(lines, result.diagnostics);
  return `${lines.join("\n")}\n`;
}

export function renderPlanningHistoricalObservationText(
  operation: "work.observe" | "window.observe",
  result: PlanningPoolHistoricalObservationResult,
): string {
  const lines = [
    `${operation === "work.observe" ? "WORK" : "WINDOW"} OBSERVATION HISTORY`,
    `Document: ${result.documentId ?? NONE}`,
    `Source digest: ${result.sourceDigest}`,
    `Evidence: ${result.evidence.state} (${result.evidence.ancestryProfile})`,
  ];
  const axes = [
    ["REFINEMENT", result.axisStates.refinement],
    ["EXECUTION", result.axisStates.execution],
    ["OUTCOME", result.axisStates.outcome],
    ["ORGANIZATION", result.axisStates.organization],
    ["TEMPORAL", result.axisStates.temporal],
  ] as const;
  for (const [title, state] of axes) {
    heading(lines, title);
    lines.push(`Historical state: ${state}`);
  }
  heading(lines, "GLOBAL EXECUTION");
  lines.push(
    `Current authority: ${result.current.state}`,
    `Snapshots: ${result.snapshots.length}`,
    `Continuity qualified: ${yesNo(result.evidence.continuityQualified)}`,
  );
  heading(lines, "HISTORY");
  lines.push(
    `Endpoint: ${result.evidence.resolvedEndpoint ?? NONE}`,
    `Work occurrences: ${result.lineage?.workOccurrences.length ?? 0}`,
    `Window occurrences: ${result.lineage?.windowOccurrences.length ?? 0}`,
    `Relation occurrences: ${result.lineage?.relationOccurrences.length ?? 0}`,
    `Gaps: ${result.lineage?.gaps.length ?? 0}`,
  );
  renderDiagnostics(lines, result.diagnostics);
  return `${lines.join("\n")}\n`;
}

function descriptionRows(
  lines: string[],
  label: string,
  rows: readonly PlanningReshapeDescriptionRow[],
): void {
  lines.push(`${label}: ${rows.length === 0 ? NONE : ""}`.trimEnd());
  for (const row of rows) {
    const description = row.description.replaceAll("\n", "\\n");
    lines.push(
      `  ${row.workId}: ${description === "" ? NONE : description}  elements=${joined(row.elementIds)}`,
    );
  }
}

function reshapeNextAction(result: PlanningReshapePreflightResult): string {
  if (!result.ok) return "Correct the reported diagnostics and rerun preflight.";
  if (!result.changed) return "No source change is proposed; retain the document or revise the request.";
  if (result.preflightHash === null || result.preflightToken === null) {
    return "Rerun preflight to obtain a complete hash and token binding.";
  }
  const owner = result.authorityImpact?.requiredOwner;
  return result.authorityImpact?.userResponseRequired === true
    ? `Obtain candidate-bound confirmation from ${owner ?? "the required owner"}, then run work reshape apply with the same request, preflight hash, and token.`
    : "Run work reshape apply with the same request, preflight hash, and token.";
}

export function renderPlanningReshapePreflightText(
  result: PlanningReshapePreflightResult,
): string {
  const request = result.normalizedRequest;
  const lines = [
    "RESHAPE PREFLIGHT",
    `Status: ${result.ok ? "ready" : "blocked"}`,
    `Document: ${result.documentId ?? NONE}`,
    `Intent: ${request?.intent ?? NONE}`,
  ];

  heading(lines, "BINDING");
  lines.push(
    `Source digest: ${result.sourceDigest}`,
    `Candidate digest: ${result.candidateDigest ?? NONE}`,
    `Preflight hash: ${result.preflightHash ?? NONE}`,
    `Normalization: ${request?.normalization_contract ?? NONE}`,
  );

  heading(lines, "AFFECTED MEANING");
  descriptionRows(lines, "Before", result.beforeDescriptions);
  descriptionRows(lines, "After", result.afterDescriptions);

  heading(lines, "CHANGES");
  lines.push(
    `Changed: ${yesNo(result.changed)}`,
    `Text edits: ${result.edits.length}`,
    `Affected Work: ${joined(request?.affected_work_ids ?? [])}`,
    `Created Work: ${joined(request?.created_works.map(({ work_id }) => work_id) ?? [])}`,
    `Removed Work: ${joined(request?.removed_work_ids ?? [])}`,
    `Requested final Work order: ${request === null || request.final_work_order.length === 0 ? "(unchanged)" : joined(request.final_work_order)}`,
    `Planning entities: ${request?.planning_entity_dispositions.length ?? 0}`,
    `Planning associations: ${request?.association_dispositions.length ?? 0}`,
    `Strict links: ${request?.projection_link_dispositions.length ?? 0}`,
    `Dependencies: ${request?.dependency_dispositions.length ?? 0}`,
    `Window memberships: ${request?.window_membership_dispositions.length ?? 0}`,
  );

  heading(lines, "DIAGNOSTICS");
  if (result.diagnostics.length === 0) lines.push(NONE);
  lines.push(...result.diagnostics.map((diagnostic) =>
    `${diagnostic.code} ${diagnostic.severity}: ${diagnostic.message}`
  ));

  heading(lines, "AUTHORITY");
  lines.push(
    `Affected scopes: ${joined(result.authorityImpact?.affectedScopes ?? [])}`,
    `Required owner: ${result.authorityImpact?.requiredOwner ?? NONE}`,
    `Owner response required: ${yesNo(result.authorityImpact?.userResponseRequired ?? false)}`,
  );

  heading(lines, "TOKEN");
  lines.push(
    `Preflight token: ${result.preflightToken ?? NONE}`,
    `Expires at: ${result.tokenExpiresAt ?? NONE}`,
  );

  heading(lines, "NEXT ACTION");
  lines.push(reshapeNextAction(result));
  return `${lines.join("\n")}\n`;
}
