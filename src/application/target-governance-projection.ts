import type {
  TargetGovernanceProjectMetadata,
  TargetGovernanceProjectMetadataResult,
} from "./target-governance-project.js";
import type {
  TargetGovernanceAdvanceResultV2,
  TargetGovernanceMutationResultV2,
} from "./target-governance-mutation.js";
import type {
  GovernanceDecisionV1,
  GovernanceScopeDecision,
} from "../governance/types.js";
import type { Diagnostic, SourceSpan } from "../model/diagnostics.js";
import { compareStableStrings } from "../model/diagnostics.js";
import type { TargetCalendarValue } from "../model/target-calendar.js";
import { TOOL_VERSION } from "../version.js";

export const TARGET_GOVERNANCE_CLI_CONTRACT_VERSION = 5 as const;
export const TARGET_GOVERNANCE_PROJECT_RESULT_SCHEMA_VERSION =
  "Perttool.ProjectResult.v3" as const;
export const TARGET_GOVERNANCE_MUTATION_RESULT_SCHEMA_VERSION =
  "Perttool.MutationResult.v2" as const;

export interface TargetGovernanceWriteProjection {
  readonly mode: "preview" | "in_place" | "out";
  readonly target: string | null;
  readonly written: boolean;
}

export const TARGET_GOVERNANCE_PREVIEW_WRITE: TargetGovernanceWriteProjection =
  Object.freeze({
    mode: "preview",
    target: null,
    written: false,
  });

function jsonPosition(position: SourceSpan["start"]): {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
} {
  return {
    offset: position.offset,
    line: position.line + 1,
    column: position.column + 1,
  };
}

function jsonSpan(span: SourceSpan): {
  readonly start: ReturnType<typeof jsonPosition>;
  readonly end: ReturnType<typeof jsonPosition>;
} {
  return {
    start: jsonPosition(span.start),
    end: jsonPosition(span.end),
  };
}

function diagnosticToJson(
  diagnostic: Diagnostic,
): Readonly<Record<string, unknown>> {
  return {
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    entity_id: diagnostic.entityId ?? null,
    span: diagnostic.span === undefined ? null : jsonSpan(diagnostic.span),
    related: (diagnostic.related ?? []).map((related) => ({
      message: related.message,
      span: jsonSpan(related.span),
    })),
    help_topic: null,
    guide_topic: diagnostic.helpTopic ?? null,
    expected_syntax: diagnostic.expectedSyntax ?? null,
    fixes: [],
    data: diagnostic.data ?? {},
  };
}

function calendarToJson(
  value: TargetCalendarValue | null,
): Readonly<Record<string, unknown>> | null {
  if (value === null) return null;
  return value.kind === "date"
    ? {
        kind: value.kind,
        source_text: value.sourceText,
        year: value.year,
        month: value.month,
        day: value.day,
      }
    : {
        kind: value.kind,
        source_text: value.sourceText,
        year: value.year,
        month: value.month,
        day: value.day,
        hour: value.hour,
        minute: value.minute,
        second: {
          numerator: value.second.numerator,
          denominator: value.second.denominator,
        },
        offset_minutes: value.offsetMinutes,
      };
}

function projectToJson(
  project: TargetGovernanceProjectMetadata,
): Readonly<Record<string, unknown>> {
  return {
    id: project.id,
    version: project.version,
    title: project.title,
    description: project.description,
    as_of: calendarToJson(project.asOf),
    duration_unit: project.durationUnit,
    velocity: project.velocity,
    finish: project.finish,
    finish_deadline: calendarToJson(project.finishDeadline),
    governance: {
      source_contract_version: project.governance.sourceContractVersion,
      declared: {
        goal_owner: project.governance.declared.goalOwner,
        goal_delegates: project.governance.declared.goalDelegates,
        dag_owner: project.governance.declared.dagOwner,
        dag_delegates: project.governance.declared.dagDelegates,
      },
      effective: {
        goal_owner: project.governance.effective.goalOwner,
        goal_delegates: [
          ...project.governance.effective.goalDelegates,
        ].sort(compareStableStrings),
        dag_owner: project.governance.effective.dagOwner,
        dag_delegates: [
          ...project.governance.effective.dagDelegates,
        ].sort(compareStableStrings),
      },
    },
    critical_epsilon: project.criticalEpsilon,
    target_duration: project.targetDuration,
  };
}

export function targetGovernanceProjectResultToJson(
  result: TargetGovernanceProjectMetadataResult,
  source: string,
  sourceDigest: string,
  ok = result.ok,
): Readonly<Record<string, unknown>> {
  return {
    schema_version: TARGET_GOVERNANCE_PROJECT_RESULT_SCHEMA_VERSION,
    cli_contract_version: TARGET_GOVERNANCE_CLI_CONTRACT_VERSION,
    tool_version: TOOL_VERSION,
    operation: "project.show",
    ok,
    document_id: result.documentId,
    source,
    source_digest: sourceDigest,
    diagnostics: result.diagnostics.map(diagnosticToJson),
    diagnostics_truncated: result.diagnosticsTruncated,
    grammar_version: result.grammarVersion,
    project: result.project === null ? null : projectToJson(result.project),
  };
}

function principalList(values: readonly string[]): string {
  return `[${values.join(", ")}]`;
}

function optional(value: string | null): string {
  return value ?? "-";
}

function calendarText(value: TargetCalendarValue | null): string {
  return value === null
    ? "-"
    : `${value.kind.toUpperCase()} ${value.sourceText ?? "-"}`;
}

export function renderTargetGovernanceProjectText(
  project: TargetGovernanceProjectMetadata,
): string {
  const declared = project.governance.declared;
  const effective = project.governance.effective;
  return [
    `PROJECT ${project.id}`,
    `VERSION ${project.version}`,
    `TITLE ${JSON.stringify(project.title)}`,
    `DESCRIPTION ${project.description === null ? "-" : JSON.stringify(project.description)}`,
    `AS_OF ${calendarText(project.asOf)}`,
    `DURATION_UNIT ${project.durationUnit}`,
    `VELOCITY ${optional(project.velocity)}`,
    `FINISH ${project.finish}`,
    `FINISH_DEADLINE ${calendarText(project.finishDeadline)}`,
    `GOAL_OWNER declared=${optional(declared.goalOwner)} effective=${effective.goalOwner}`,
    `GOAL_DELEGATES declared=${declared.goalDelegates === null ? "-" : principalList(declared.goalDelegates)} effective=${principalList([...effective.goalDelegates].sort(compareStableStrings))}`,
    `DAG_OWNER declared=${optional(declared.dagOwner)} effective=${effective.dagOwner}`,
    `DAG_DELEGATES declared=${declared.dagDelegates === null ? "-" : principalList(declared.dagDelegates)} effective=${principalList([...effective.dagDelegates].sort(compareStableStrings))}`,
    `CRITICAL_EPSILON ${optional(project.criticalEpsilon)}`,
    `TARGET_DURATION ${optional(project.targetDuration)}`,
    "",
  ].join("\n");
}

function scopeDecisionToJson(
  decision: GovernanceScopeDecision,
): Readonly<Record<string, unknown>> {
  return {
    scope: decision.scope,
    required_owner: decision.requiredOwner,
    effective_delegates: decision.effectiveDelegates,
    actor_direct: decision.actorDirect,
    owner_confirmation_required: decision.ownerConfirmationRequired,
    owner_confirmation_present: decision.ownerConfirmationPresent,
    scope_authorized: decision.scopeAuthorized,
    denial_cause: decision.denialCause,
  };
}

export function targetGovernanceDecisionToJson(
  decision: GovernanceDecisionV1,
): Readonly<Record<string, unknown>> {
  return {
    schema_version: decision.schemaVersion,
    governance_interface_version: decision.governanceInterfaceVersion,
    governance_source_contract_version:
      decision.governanceSourceContractVersion,
    governance_semantics_version: decision.governanceSemanticsVersion,
    source_digest: decision.sourceDigest,
    intent: decision.intent,
    applicable: decision.applicable,
    actor: decision.actor,
    accepted_by_owner: decision.acceptedByOwner,
    affected_scopes: decision.affectedScopes,
    required_owner_confirmations: decision.requiredOwnerConfirmations,
    owner_confirmation_required: decision.ownerConfirmationRequired,
    write_authorized: decision.writeAuthorized,
    scopes: decision.scopes.map(scopeDecisionToJson),
  };
}

function mutationCandidateToJson(
  result:
    | TargetGovernanceMutationResultV2
    | TargetGovernanceAdvanceResultV2,
  write: TargetGovernanceWriteProjection,
): Readonly<Record<string, unknown>> {
  const hasCandidate =
    result.updatedDigest !== null && result.updatedText !== null;
  const written =
    result.ok && write.mode !== "preview" && write.written;
  return {
    changed: hasCandidate ? result.changed : false,
    original_digest: result.originalDigest,
    updated_digest: hasCandidate ? result.updatedDigest : null,
    updated_text: hasCandidate ? result.updatedText : null,
    diff: hasCandidate ? result.diff : null,
    edits: (hasCandidate ? result.edits : []).map((edit) => ({
      start_offset: edit.startOffset,
      end_offset: edit.endOffset,
      replacement: edit.replacement,
    })),
    write: {
      mode: write.mode,
      target: write.target,
      written,
    },
  };
}

function advanceToJson(
  result: TargetGovernanceAdvanceResultV2["advance"],
): Readonly<Record<string, unknown>> | null {
  return result === null
    ? null
    : {
        removed_task_ids: result.removedTaskIds,
        removed_gate_ids: result.removedGateIds,
        removed_milestone_ids: result.removedMilestoneIds,
        frontier_before: result.frontierBefore,
        frontier_after: result.frontierAfter,
        ready_before: result.readyBefore,
        ready_after: result.readyAfter,
      };
}

export function targetGovernanceMutationResultToJson(
  result:
    | TargetGovernanceMutationResultV2
    | TargetGovernanceAdvanceResultV2,
  operation: string,
  source: string,
  write: TargetGovernanceWriteProjection =
    TARGET_GOVERNANCE_PREVIEW_WRITE,
): Readonly<Record<string, unknown>> {
  const base = {
    schema_version: TARGET_GOVERNANCE_MUTATION_RESULT_SCHEMA_VERSION,
    cli_contract_version: TARGET_GOVERNANCE_CLI_CONTRACT_VERSION,
    tool_version: TOOL_VERSION,
    operation,
    ok: result.ok,
    document_id: result.documentId,
    source,
    source_digest: result.originalDigest,
    diagnostics: result.diagnostics.map(diagnosticToJson),
    diagnostics_truncated: result.diagnosticsTruncated,
    ...mutationCandidateToJson(result, write),
    governance:
      result.governance === null
        ? null
        : targetGovernanceDecisionToJson(result.governance),
  };
  return "advance" in result
    ? { ...base, advance: advanceToJson(result.advance) }
    : base;
}

function compactList(values: readonly string[]): string {
  return values.length === 0 ? "-" : values.join(",");
}

export function renderTargetGovernanceDecision(
  decision: GovernanceDecisionV1,
): string {
  if (!decision.applicable) return "";
  const lines = [
    `GOVERNANCE intent=${decision.intent} applicable=true actor=${decision.actor ?? "-"} affected_scopes=${compactList(decision.affectedScopes)} required_owner_confirmations=${compactList(decision.requiredOwnerConfirmations)} accepted_by_owner=${compactList(decision.acceptedByOwner)} write_authorized=${decision.writeAuthorized}`,
    ...decision.scopes.map(
      (scope) =>
        `GOVERNANCE_SCOPE scope=${scope.scope} required_owner=${scope.requiredOwner} delegates=${compactList(scope.effectiveDelegates)} actor_direct=${scope.actorDirect} owner_confirmation_required=${scope.ownerConfirmationRequired} owner_confirmation_present=${scope.ownerConfirmationPresent} scope_authorized=${scope.scopeAuthorized} denial_cause=${scope.denialCause ?? "-"}`,
    ),
  ];
  return `${lines.join("\n")}\n`;
}
