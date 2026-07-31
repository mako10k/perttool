import {
  projectDeclaredCalendarValue,
} from "../model/target-calendar.js";
import {
  formatDecimal,
} from "../model/rational.js";
import type {
  ActualWorkEvent,
} from "../actuals/source.js";
import type {
  TargetActualsAdvanceResultV3,
} from "./target-actuals-advance.js";
import type {
  AdvanceHistoryGuardV1,
  AdvanceResultV1,
} from "./advance-history.js";
import type {
  TargetActualsMutationResultV3,
} from "./target-actuals-mutation.js";
import {
  targetGovernanceMutationResultToJson,
  targetGovernanceProjectResultToJson,
  type TargetGovernanceWriteProjection,
} from "./target-governance-projection.js";
import type {
  TargetGovernanceAdvanceResultV2,
  TargetGovernanceMutationResultV2,
} from "./target-governance-mutation.js";
import type {
  TargetGovernanceProjectMetadataResult,
} from "./target-governance-project.js";

export function contract6ProjectResultToJson(
  result: TargetGovernanceProjectMetadataResult,
  source: string,
  sourceDigest: string,
  ok = result.ok,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    ...targetGovernanceProjectResultToJson(
      result,
      source,
      sourceDigest,
      ok,
    ),
    cli_contract_version: 6,
  });
}

function calendarToJson(event: ActualWorkEvent) {
  const value = projectDeclaredCalendarValue(event.occurredAt);
  if (value === null) {
    throw new Error("validated lifecycle event lost its calendar projection");
  }
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

function quantityToJson(
  value: { readonly value: {
    readonly numerator: bigint;
    readonly denominator: bigint;
  } } | null,
  unit: "day" | "hour" | "point" | "person_hour",
): Readonly<Record<string, unknown>> | null {
  return value === null
    ? null
    : {
        numerator: value.value.numerator.toString(),
        denominator: value.value.denominator.toString(),
        unit,
        display: formatDecimal(value.value, 6),
      };
}

export function contract6WorkEventToJson(
  event: ActualWorkEvent,
): Readonly<Record<string, unknown>> {
  return {
    model_version: event.model,
    id: event.id,
    task_id: event.taskId,
    kind: event.kind,
    occurred_at: calendarToJson(event),
    planned_value:
      event.plannedValue === null
        ? null
        : quantityToJson(event.plannedValue, event.plannedValue.unit),
    active_time: quantityToJson(event.activeTime, "hour"),
    effort: quantityToJson(event.effort, "person_hour"),
    reason: event.reason,
  };
}

function lifecycleToJson(
  result: TargetActualsMutationResultV3,
): Readonly<Record<string, unknown>> | null {
  const lifecycle = result.lifecycle;
  return lifecycle === null
    ? null
    : {
        model_version: lifecycle.modelVersion,
        task_id: lifecycle.taskId,
        from_state: lifecycle.fromState,
        to_state: lifecycle.toState,
        event: contract6WorkEventToJson(lifecycle.event),
        coverage: lifecycle.coverage,
      };
}

function advanceHistoryGuardToJson(
  value: AdvanceHistoryGuardV1,
): Readonly<Record<string, unknown>> {
  return {
    model_version: value.modelVersion,
    status: value.status,
    cause: value.cause,
    repository_snapshot_id: value.repositorySnapshotId,
    repository_relative_path: value.repositoryRelativePath,
    head_commit_id: value.headCommitId,
    source_digest: value.sourceDigest,
    candidate_digest: value.candidateDigest,
    source_modified_at: value.sourceModifiedAt,
    source_bytes: value.sourceBytes,
    candidate_bytes: value.candidateBytes,
    diff_added_lines: value.diffAddedLines,
    diff_removed_lines: value.diffRemovedLines,
    destructive_entity_ids: value.destructiveEntityIds,
    overlapping_entity_ids: value.overlappingEntityIds,
    force_requested: value.forceRequested,
  };
}

export function contract6MutationResultToJson(
  result:
    | TargetActualsMutationResultV3
    | TargetActualsAdvanceResultV3
    | AdvanceResultV1,
  operation: string,
  source: string,
  write: TargetGovernanceWriteProjection,
): Readonly<Record<string, unknown>> {
  const base = targetGovernanceMutationResultToJson(
    result as unknown as
      | TargetGovernanceMutationResultV2
      | TargetGovernanceAdvanceResultV2,
    operation,
    source,
    write,
  );
  if ("advance" in result) {
    const historyGuard =
      "historyGuard" in result ? result.historyGuard : undefined;
    return Object.freeze({
      ...base,
      schema_version:
        historyGuard === undefined
          ? "Perttool.MutationResult.v3"
          : "Perttool.AdvanceResult.v1",
      cli_contract_version: 6,
      lifecycle: null,
      advance:
        result.advance === null
          ? null
          : {
              removed_task_ids: result.advance.removedTaskIds,
              removed_gate_ids: result.advance.removedGateIds,
              removed_milestone_ids: result.advance.removedMilestoneIds,
              removed_work_event_ids:
                result.advance.removedWorkEventIds,
              frontier_before: result.advance.frontierBefore,
              frontier_after: result.advance.frontierAfter,
              ready_before: result.advance.readyBefore,
              ready_after: result.advance.readyAfter,
            },
      ...(historyGuard === undefined
        ? {}
        : {
            history_guard:
              historyGuard === null
                ? null
                : advanceHistoryGuardToJson(historyGuard),
          }),
    });
  }
  return Object.freeze({
    ...base,
    schema_version: "Perttool.MutationResult.v3",
    cli_contract_version: 6,
    lifecycle: lifecycleToJson(result),
  });
}
