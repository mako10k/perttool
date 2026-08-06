import {
  canonicalJson,
  sha256Canonical,
} from "../assurance/canonical.js";
import type { Sha256Digest } from "../assurance/types.js";
import { governanceMetadataFromDocument } from "../governance/source.js";
import {
  parseDeclaredCalendarValue,
  type DeclaredCalendarValue,
} from "../model/calendar.js";
import type { SourcePosition, SourceSpan } from "../model/diagnostics.js";
import {
  rational,
  rationalFromDuration,
  type Rational,
} from "../model/rational.js";
import { sha256DigestUtf8 } from "../model/sha256.js";
import type {
  AcceptedPlanningInputValue,
  AssuranceConsumerValue,
  DeclarationNode,
  ExactDurationValue,
  ExactPersonHoursValue,
  FieldNode,
  RequirementValue,
  TargetDeclarationKind,
  VelocityValue,
} from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import type { TargetGrammar6ValidatedDocument } from "../semantic/target-validator.js";

export const HISTORICAL_TRANSITION_MODEL_VERSION = 1 as const;
export const HISTORICAL_TRANSITION_MODEL_ID =
  "Perttool.HistoricalTransitionModel.v1" as const;

export type HistoricalEntityKind =
  | "milestone"
  | "task"
  | "gate"
  | "resource";

export type HistoricalTransitionClass =
  | "initial"
  | "representation_only"
  | "evidence_extension"
  | "lifecycle_projection"
  | "future_plan_edit"
  | "canonical_advance"
  | "ambiguous_edit"
  | "conflict";

export type HistoricalTransitionCause =
  | "event_payload_changed"
  | "identity_ambiguous"
  | "ambiguous_edit"
  | "noncanonical_removal"
  | "topology_conflict";

export type HistoricalExactUnit =
  | "day"
  | "hour"
  | "point"
  | "person_hour";

export interface HistoricalExactValueV1 {
  readonly numerator: string;
  readonly denominator: string;
  readonly unit: HistoricalExactUnit;
}

export type HistoricalCalendarValueV1 =
  | {
      readonly kind: "date";
      readonly year: number;
      readonly month: number;
      readonly day: number;
    }
  | {
      readonly kind: "date_time";
      readonly year: number;
      readonly month: number;
      readonly day: number;
      readonly hour: number;
      readonly minute: number;
      readonly second: {
        readonly numerator: string;
        readonly denominator: string;
      };
      readonly offset_minutes: number;
    };

export type HistoricalTimingV1 =
  | {
      readonly kind: "duration";
      readonly value: HistoricalExactValueV1;
    }
  | {
      readonly kind: "estimate";
      readonly optimistic: HistoricalExactValueV1;
      readonly most_likely: HistoricalExactValueV1;
      readonly pessimistic: HistoricalExactValueV1;
    };

export interface HistoricalGovernanceV1 {
  readonly declared: {
    readonly goal_owner: string | null;
    readonly goal_delegates: readonly string[] | null;
    readonly dag_owner: string | null;
    readonly dag_delegates: readonly string[] | null;
  };
  readonly effective: {
    readonly goal_owner: string;
    readonly goal_delegates: readonly string[];
    readonly dag_owner: string;
    readonly dag_delegates: readonly string[];
  };
}

export interface HistoricalProjectSemanticV1 {
  readonly id: string;
  readonly grammar_version: 1 | 2 | 3 | 4 | 5 | 6;
  readonly title: string;
  readonly description: string | null;
  readonly as_of: HistoricalCalendarValueV1 | null;
  readonly duration_unit: "day" | "hour" | "point";
  readonly velocity: {
    readonly points: HistoricalExactValueV1;
    readonly period: HistoricalExactValueV1;
  } | null;
  readonly finish_milestone_id: string;
  readonly critical_epsilon: HistoricalExactValueV1;
  readonly target_duration: HistoricalExactValueV1 | null;
  readonly governance: HistoricalGovernanceV1;
  readonly plan_assurance: {
    readonly model_version: number | null;
    readonly hash_model_version: number | null;
  };
}

export interface HistoricalResourceSemanticV1 {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly capacity: number;
  readonly tags: readonly string[];
}

export interface HistoricalMilestoneSemanticV1 {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly state: "planned" | "reached";
  readonly deadline: HistoricalCalendarValueV1 | null;
  readonly tags: readonly string[];
}

export interface HistoricalTaskSemanticV1 {
  readonly id: string;
  readonly from_milestone_id: string;
  readonly to_milestone_id: string;
  readonly plan: {
    readonly title: string;
    readonly description: string | null;
    readonly timing: HistoricalTimingV1;
    readonly not_before: HistoricalCalendarValueV1 | null;
    readonly deadline: HistoricalCalendarValueV1 | null;
    readonly priority: number;
    readonly requirements: readonly {
      readonly resource_id: string;
      readonly units: number;
    }[];
    readonly owner: string | null;
    readonly tags: readonly string[];
    readonly source: string | null;
  };
  readonly lifecycle: {
    readonly status:
      | "planned"
      | "active"
      | "blocked"
      | "suspended"
      | "done";
    readonly blocked_reason: string | null;
  };
}

export interface HistoricalGateSemanticV1 {
  readonly id: string;
  readonly from_milestone_id: string;
  readonly to_milestone_id: string;
  readonly reason: string;
}

export interface HistoricalWorkEventSemanticV1 {
  readonly id: string;
  readonly model: 1;
  readonly task_id: string;
  readonly kind: "start" | "suspend" | "resume" | "finish";
  readonly occurred_at: HistoricalCalendarValueV1;
  readonly planned_value: HistoricalExactValueV1 | null;
  readonly active_time: HistoricalExactValueV1 | null;
  readonly effort: HistoricalExactValueV1 | null;
  readonly reason: string | null;
}

export interface HistoricalTaskRelationSemanticV1 {
  readonly id: string;
  readonly predecessor_task_id: string;
  readonly successor_task_id: string;
  readonly mode: "both" | "execution_only" | "planning_only";
  readonly reason: string | null;
}

export interface HistoricalPlanSealSemanticV1 {
  readonly task_id: string;
  readonly accepted_contract: string;
  readonly accepted_basis: string;
  readonly accepted_inputs: readonly {
    readonly predecessor_task_id: string;
    readonly relation_mode: "both" | "planning_only";
    readonly assurance_hash: string;
  }[];
  readonly reason: string | null;
}

export interface HistoricalTaskOutcomeSemanticV1 {
  readonly id: string;
  readonly model: 1;
  readonly task_id: string;
  readonly against_basis: string;
  readonly status: "conformant" | "changed";
  readonly summary: string | null;
  readonly reason: string;
}

export interface HistoricalAssuranceReceiptSemanticV1 {
  readonly id: string;
  readonly model: 1;
  readonly receipt_hash: string;
  readonly producer_task_id: string;
  readonly producer_contract_hash: string;
  readonly producer_assurance_hash: string;
  readonly outcome: "conformant" | "changed";
  readonly source_milestone_id: string | null;
  readonly consumers: readonly {
    readonly consumer_task_id: string;
    readonly relation_mode: "both" | "planning_only";
  }[];
}

export interface HistoricalTransitionSemanticModelV1 {
  readonly model: typeof HISTORICAL_TRANSITION_MODEL_ID;
  readonly model_version: typeof HISTORICAL_TRANSITION_MODEL_VERSION;
  readonly project: HistoricalProjectSemanticV1;
  readonly resources: readonly HistoricalResourceSemanticV1[];
  readonly milestones: readonly HistoricalMilestoneSemanticV1[];
  readonly tasks: readonly HistoricalTaskSemanticV1[];
  readonly gates: readonly HistoricalGateSemanticV1[];
  readonly work_events: readonly HistoricalWorkEventSemanticV1[];
  readonly task_relations: readonly HistoricalTaskRelationSemanticV1[];
  readonly plan_seals: readonly HistoricalPlanSealSemanticV1[];
  readonly task_outcomes: readonly HistoricalTaskOutcomeSemanticV1[];
  readonly assurance_receipts:
    readonly HistoricalAssuranceReceiptSemanticV1[];
}

export interface HistoricalSourceRangeV1 {
  readonly start: SourcePosition;
  readonly end: SourcePosition;
}

export interface HistoricalSourceFieldV1 {
  readonly name: string;
  readonly ordinal: number;
  readonly raw_value: string;
  readonly range: HistoricalSourceRangeV1;
  readonly value_range: HistoricalSourceRangeV1;
  readonly child_ranges: readonly {
    readonly name: string;
    readonly ordinal: number;
    readonly raw_value: string;
    readonly range: HistoricalSourceRangeV1;
    readonly value_range: HistoricalSourceRangeV1;
  }[];
}

export interface HistoricalSourceDeclarationV1 {
  readonly kind: TargetDeclarationKind;
  readonly id: string;
  readonly ordinal: number;
  readonly from_id: string | null;
  readonly to_id: string | null;
  readonly range: HistoricalSourceRangeV1;
  readonly id_range: HistoricalSourceRangeV1;
  readonly fields: readonly HistoricalSourceFieldV1[];
}

export interface HistoricalSourceFidelityV1 {
  readonly source_digest: Sha256Digest;
  readonly utf16_length: number;
  readonly declarations: readonly HistoricalSourceDeclarationV1[];
}

export interface HistoricalTransitionAxisDigestsV1 {
  readonly planning: Sha256Digest;
  readonly lifecycle: Sha256Digest;
  readonly actual_evidence: Sha256Digest;
  readonly governance: Sha256Digest;
  readonly assurance: Sha256Digest;
  readonly topology: Sha256Digest;
}

export interface HistoricalTransitionProjectionV1 {
  readonly model_version: typeof HISTORICAL_TRANSITION_MODEL_VERSION;
  readonly semantic_digest: Sha256Digest;
  readonly semantic: HistoricalTransitionSemanticModelV1;
  readonly axes: HistoricalTransitionAxisDigestsV1;
  readonly source_fidelity: HistoricalSourceFidelityV1;
}

export interface HistoricalOccurrenceKeyV1 {
  readonly projectId: string;
  readonly entityKind: HistoricalEntityKind;
  readonly sourceId: string;
  readonly introducedCommitId: string;
}

export interface HistoricalCanonicalAdvanceCandidateV1 {
  readonly planner_version: string;
  readonly base_semantic_digest: Sha256Digest;
  readonly candidate: HistoricalTransitionProjectionV1;
  readonly complete: boolean;
  readonly force_requested: boolean;
  readonly owner_assertion_used: boolean;
  readonly repository_proof_assumed: boolean;
  readonly persistence_assumed: boolean;
}

export interface HistoricalTransitionClassificationV1 {
  readonly class: HistoricalTransitionClass;
  readonly causes: readonly HistoricalTransitionCause[];
  readonly semantic_changed: boolean;
  readonly source_changed: boolean;
  readonly changed_axes: readonly (keyof HistoricalTransitionAxisDigestsV1)[];
  readonly is_merge_commit: boolean;
  readonly canonical_advance: {
    readonly planner_version: string;
    readonly candidate_semantic_digest: Sha256Digest;
  } | null;
}

export interface HistoricalTransitionSequenceInputV1 {
  readonly commit_id: string;
  readonly projection: HistoricalTransitionProjectionV1;
  readonly connected_to_previous: boolean;
  readonly is_merge_commit: boolean;
  readonly canonical_advance_candidate?: HistoricalCanonicalAdvanceCandidateV1;
}

export interface HistoricalEntityValueEpochV1 {
  readonly entity_kind: HistoricalEntityKind;
  readonly source_id: string;
  readonly occurrence_id: string | null;
  readonly value_epoch_ordinal: number | null;
  readonly value_digest: Sha256Digest;
}

export interface HistoricalTopologyEntryV1 {
  readonly entity_kind: "task" | "gate";
  readonly source_id: string;
  readonly occurrence_id: string;
  readonly from_occurrence_id: string;
  readonly to_occurrence_id: string;
}

export interface HistoricalTransitionSequenceCheckpointV1 {
  readonly commit_id: string;
  readonly semantic_digest: Sha256Digest;
  readonly transition: HistoricalTransitionClassificationV1;
  readonly entity_value_epochs: readonly HistoricalEntityValueEpochV1[];
  readonly topology_epoch_id: string | null;
}

export interface HistoricalTransitionSequenceCauseV1 {
  readonly cause: HistoricalTransitionCause;
  readonly commit_id: string;
  readonly entity_kind: HistoricalEntityKind | null;
  readonly source_id: string | null;
}

export interface HistoricalTransitionSequenceV1 {
  readonly model_version: typeof HISTORICAL_TRANSITION_MODEL_VERSION;
  readonly checkpoints: readonly HistoricalTransitionSequenceCheckpointV1[];
  readonly causes: readonly HistoricalTransitionSequenceCauseV1[];
}

const entityKindOrder: Readonly<Record<HistoricalEntityKind, number>> = {
  milestone: 0,
  task: 1,
  gate: 2,
  resource: 3,
};

const trustworthyTransitionClasses = new Set<HistoricalTransitionClass>([
  "representation_only",
  "evidence_extension",
  "lifecycle_projection",
  "future_plan_edit",
  "canonical_advance",
]);

const fullObjectIdPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

function compareUnicodeScalars(left: string, right: string): number {
  const leftScalars = Array.from(left, (value) => value.codePointAt(0)!);
  const rightScalars = Array.from(right, (value) => value.codePointAt(0)!);
  const common = Math.min(leftScalars.length, rightScalars.length);
  for (let index = 0; index < common; index += 1) {
    const difference = leftScalars[index]! - rightScalars[index]!;
    if (difference !== 0) return difference;
  }
  return leftScalars.length - rightScalars.length;
}

function compareEntity(
  left: { readonly kind: HistoricalEntityKind; readonly id: string },
  right: { readonly kind: HistoricalEntityKind; readonly id: string },
): number {
  return entityKindOrder[left.kind] - entityKindOrder[right.kind] ||
    compareUnicodeScalars(left.id, right.id);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Readonly<Record<string, unknown>>)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

function requiredField(
  declaration: DeclarationNode<TargetDeclarationKind>,
  name: string,
): FieldNode {
  const field = fieldNamed(declaration, name);
  if (field === undefined) {
    throw new Error(
      `validated ${declaration.kind} ${declaration.id} is missing ${name}`,
    );
  }
  return field;
}

function requiredString(
  declaration: DeclarationNode<TargetDeclarationKind>,
  name: string,
): string {
  const value = requiredField(declaration, name).value;
  if (typeof value !== "string") {
    throw new Error(
      `validated ${declaration.kind} ${declaration.id}.${name} is not a string`,
    );
  }
  return value;
}

function optionalString(
  declaration: DeclarationNode<TargetDeclarationKind>,
  name: string,
): string | null {
  const value = fieldNamed(declaration, name)?.value;
  if (value === undefined) return null;
  if (typeof value !== "string") {
    throw new Error(
      `validated ${declaration.kind} ${declaration.id}.${name} is not a string`,
    );
  }
  return value;
}

function durationValue(field: FieldNode): ExactDurationValue {
  const value = field.value;
  if (
    value === null ||
    typeof value !== "object" ||
    !("suffix" in value) ||
    (!("digits" in value) && !("numerator" in value))
  ) {
    throw new Error(`validated ${field.name} is not an exact duration`);
  }
  return value as ExactDurationValue;
}

function personHoursValue(field: FieldNode): ExactPersonHoursValue {
  const value = field.value;
  if (
    value === null ||
    typeof value !== "object" ||
    !("suffix" in value) ||
    value.suffix !== "ph" ||
    (!("digits" in value) && !("numerator" in value))
  ) {
    throw new Error(`validated ${field.name} is not exact person-hours`);
  }
  return value as ExactPersonHoursValue;
}

function exactRecord(
  value: Rational,
  unit: HistoricalExactUnit,
): HistoricalExactValueV1 {
  return {
    numerator: value.numerator.toString(),
    denominator: value.denominator.toString(),
    unit,
  };
}

function durationUnit(
  suffix: ExactDurationValue["suffix"],
): Exclude<HistoricalExactUnit, "person_hour"> {
  return suffix === "d" ? "day" : suffix === "h" ? "hour" : "point";
}

function exactDuration(field: FieldNode): HistoricalExactValueV1 {
  const value = durationValue(field);
  return exactRecord(rationalFromDuration(value), durationUnit(value.suffix));
}

function exactPersonHours(field: FieldNode): HistoricalExactValueV1 {
  const value = personHoursValue(field);
  const exact = "numerator" in value
    ? rational(value.numerator, value.denominator)
    : rational(value.digits, 10n ** BigInt(value.scale));
  return exactRecord(exact, "person_hour");
}

function calendarValue(field: FieldNode | undefined): HistoricalCalendarValueV1 | null {
  if (field === undefined) return null;
  const value = typeof field.value === "string"
    ? parseDeclaredCalendarValue(field.value)
    : field.value as DeclaredCalendarValue;
  if (value === undefined) {
    throw new Error(`validated ${field.name} is not a calendar value`);
  }
  if (value.kind === "date") {
    return {
      kind: "date",
      year: value.year,
      month: value.month,
      day: value.day,
    };
  }
  if (value.kind !== "date_time") {
    throw new Error(`validated ${field.name} is not a calendar value`);
  }
  return {
    kind: "date_time",
    year: value.year,
    month: value.month,
    day: value.day,
    hour: value.hour,
    minute: value.minute,
    second: {
      numerator: value.second.numerator.toString(),
      denominator: value.second.denominator.toString(),
    },
    offset_minutes: value.offsetMinutes,
  };
}

function stringList(
  declaration: DeclarationNode<TargetDeclarationKind>,
  name: string,
): readonly string[] {
  const value = fieldNamed(declaration, name)?.value ?? [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`validated ${declaration.kind}.${name} is not a string list`);
  }
  return [...value as readonly string[]].sort(compareUnicodeScalars);
}

function timing(task: DeclarationNode<TargetDeclarationKind>): HistoricalTimingV1 {
  const duration = fieldNamed(task, "duration");
  if (duration !== undefined) {
    return { kind: "duration", value: exactDuration(duration) };
  }
  const estimate = requiredField(task, "estimate");
  const component = (name: string): FieldNode => {
    const child = estimate.children?.find((candidate) => candidate.name === name);
    if (child === undefined) {
      throw new Error(`validated task ${task.id} estimate is missing ${name}`);
    }
    return child;
  };
  return {
    kind: "estimate",
    optimistic: exactDuration(component("optimistic")),
    most_likely: exactDuration(component("most_likely")),
    pessimistic: exactDuration(component("pessimistic")),
  };
}

function projectSemantic(
  validated: TargetGrammar6ValidatedDocument,
  project: DeclarationNode<TargetDeclarationKind>,
): HistoricalProjectSemanticV1 {
  const unit = requiredString(project, "duration_unit");
  if (unit !== "day" && unit !== "hour" && unit !== "point") {
    throw new Error("validated project has an invalid duration unit");
  }
  const velocityField = fieldNamed(project, "velocity");
  const velocity = velocityField?.value as VelocityValue | undefined;
  const metadata = governanceMetadataFromDocument(validated.document);
  const critical = fieldNamed(project, "critical_epsilon");
  const assuranceModel = fieldNamed(project, "plan_assurance_model")?.value;
  const assuranceHashModel = fieldNamed(
    project,
    "plan_assurance_hash_model",
  )?.value;
  return {
    id: project.id,
    grammar_version: validated.grammarVersion,
    title: requiredString(project, "title"),
    description: optionalString(project, "description"),
    as_of: calendarValue(fieldNamed(project, "as_of")),
    duration_unit: unit,
    velocity: velocity === undefined
      ? null
      : {
          points: exactRecord(rationalFromDuration(velocity.points), "point"),
          period: exactRecord(
            rationalFromDuration(velocity.period),
            durationUnit(velocity.period.suffix),
          ),
        },
    finish_milestone_id: requiredString(project, "finish"),
    critical_epsilon: critical === undefined
      ? exactRecord(rational(0n), unit)
      : exactDuration(critical),
    target_duration: fieldNamed(project, "target_duration") === undefined
      ? null
      : exactDuration(fieldNamed(project, "target_duration")!),
    governance: {
      declared: {
        goal_owner: metadata.declared.goalOwner,
        goal_delegates: metadata.declared.goalDelegates === null
          ? null
          : [...metadata.declared.goalDelegates].sort(compareUnicodeScalars),
        dag_owner: metadata.declared.dagOwner,
        dag_delegates: metadata.declared.dagDelegates === null
          ? null
          : [...metadata.declared.dagDelegates].sort(compareUnicodeScalars),
      },
      effective: {
        goal_owner: metadata.effective.goalOwner,
        goal_delegates: [...metadata.effective.goalDelegates]
          .sort(compareUnicodeScalars),
        dag_owner: metadata.effective.dagOwner,
        dag_delegates: [...metadata.effective.dagDelegates]
          .sort(compareUnicodeScalars),
      },
    },
    plan_assurance: {
      model_version: typeof assuranceModel === "number" ? assuranceModel : null,
      hash_model_version: typeof assuranceHashModel === "number"
        ? assuranceHashModel
        : null,
    },
  };
}

function resourceSemantic(
  declaration: DeclarationNode<TargetDeclarationKind>,
): HistoricalResourceSemanticV1 {
  const capacity = requiredField(declaration, "capacity").value;
  if (typeof capacity !== "number") {
    throw new Error(`validated resource ${declaration.id} has invalid capacity`);
  }
  return {
    id: declaration.id,
    title: requiredString(declaration, "title"),
    description: optionalString(declaration, "description"),
    capacity,
    tags: stringList(declaration, "tags"),
  };
}

function milestoneSemantic(
  declaration: DeclarationNode<TargetDeclarationKind>,
): HistoricalMilestoneSemanticV1 {
  const state = fieldNamed(declaration, "state")?.value ?? "planned";
  if (state !== "planned" && state !== "reached") {
    throw new Error(`validated milestone ${declaration.id} has invalid state`);
  }
  return {
    id: declaration.id,
    title: requiredString(declaration, "title"),
    description: optionalString(declaration, "description"),
    state,
    deadline: calendarValue(fieldNamed(declaration, "deadline")),
    tags: stringList(declaration, "tags"),
  };
}

function taskSemantic(
  declaration: DeclarationNode<TargetDeclarationKind>,
): HistoricalTaskSemanticV1 {
  const status = fieldNamed(declaration, "status")?.value ?? "planned";
  if (
    status !== "planned" &&
    status !== "active" &&
    status !== "blocked" &&
    status !== "suspended" &&
    status !== "done"
  ) {
    throw new Error(`validated task ${declaration.id} has invalid status`);
  }
  const priority = fieldNamed(declaration, "priority")?.value ?? 0;
  const requirements = fieldNamed(declaration, "requires")?.value ?? [];
  if (typeof priority !== "number" || !Array.isArray(requirements)) {
    throw new Error(`validated task ${declaration.id} has invalid plan values`);
  }
  return {
    id: declaration.id,
    from_milestone_id: declaration.from!,
    to_milestone_id: declaration.to!,
    plan: {
      title: requiredString(declaration, "title"),
      description: optionalString(declaration, "description"),
      timing: timing(declaration),
      not_before: calendarValue(fieldNamed(declaration, "not_before")),
      deadline: calendarValue(fieldNamed(declaration, "deadline")),
      priority,
      requirements: (requirements as readonly RequirementValue[])
        .map(({ resourceId, units }) => ({ resource_id: resourceId, units }))
        .sort((left, right) => compareUnicodeScalars(
          left.resource_id,
          right.resource_id,
        )),
      owner: optionalString(declaration, "owner"),
      tags: stringList(declaration, "tags"),
      source: optionalString(declaration, "source"),
    },
    lifecycle: {
      status,
      blocked_reason: optionalString(declaration, "blocked_reason"),
    },
  };
}

function gateSemantic(
  declaration: DeclarationNode<TargetDeclarationKind>,
): HistoricalGateSemanticV1 {
  return {
    id: declaration.id,
    from_milestone_id: declaration.from!,
    to_milestone_id: declaration.to!,
    reason: requiredString(declaration, "reason"),
  };
}

function workEventSemantic(
  declaration: DeclarationNode<TargetDeclarationKind>,
): HistoricalWorkEventSemanticV1 {
  const model = requiredField(declaration, "model").value;
  const kind = requiredField(declaration, "kind").value;
  if (
    model !== 1 ||
    (kind !== "start" &&
      kind !== "suspend" &&
      kind !== "resume" &&
      kind !== "finish")
  ) {
    throw new Error(`validated work event ${declaration.id} is invalid`);
  }
  const occurredAt = calendarValue(requiredField(declaration, "occurred_at"));
  if (occurredAt === null || occurredAt.kind !== "date_time") {
    throw new Error(`validated work event ${declaration.id} has no date-time`);
  }
  return {
    id: declaration.id,
    model,
    task_id: requiredString(declaration, "task"),
    kind,
    occurred_at: occurredAt,
    planned_value: fieldNamed(declaration, "planned_value") === undefined
      ? null
      : exactDuration(fieldNamed(declaration, "planned_value")!),
    active_time: fieldNamed(declaration, "active_time") === undefined
      ? null
      : exactDuration(fieldNamed(declaration, "active_time")!),
    effort: fieldNamed(declaration, "effort") === undefined
      ? null
      : exactPersonHours(fieldNamed(declaration, "effort")!),
    reason: optionalString(declaration, "reason"),
  };
}

function taskRelationSemantic(
  declaration: DeclarationNode<TargetDeclarationKind>,
): HistoricalTaskRelationSemanticV1 {
  const mode = requiredField(declaration, "mode").value;
  if (
    mode !== "both" &&
    mode !== "execution_only" &&
    mode !== "planning_only"
  ) {
    throw new Error(`validated task relation ${declaration.id} has invalid mode`);
  }
  return {
    id: declaration.id,
    predecessor_task_id: declaration.from!,
    successor_task_id: declaration.to!,
    mode,
    reason: optionalString(declaration, "reason"),
  };
}

function planSealSemantic(
  declaration: DeclarationNode<TargetDeclarationKind>,
): HistoricalPlanSealSemanticV1 {
  const inputs = fieldNamed(declaration, "accepted_inputs")?.value ?? [];
  if (!Array.isArray(inputs)) {
    throw new Error(`validated plan seal ${declaration.id} has invalid inputs`);
  }
  return {
    task_id: declaration.id,
    accepted_contract: requiredString(declaration, "accepted_contract"),
    accepted_basis: requiredString(declaration, "accepted_basis"),
    accepted_inputs: (inputs as readonly AcceptedPlanningInputValue[])
      .map((input) => ({
        predecessor_task_id: input.predecessorTaskId,
        relation_mode: input.relationMode,
        assurance_hash: input.assuranceHash,
      }))
      .sort((left, right) => compareUnicodeScalars(
        left.predecessor_task_id,
        right.predecessor_task_id,
      )),
    reason: optionalString(declaration, "reason"),
  };
}

function taskOutcomeSemantic(
  declaration: DeclarationNode<TargetDeclarationKind>,
): HistoricalTaskOutcomeSemanticV1 {
  const model = requiredField(declaration, "model").value;
  const status = requiredField(declaration, "status").value;
  if (model !== 1 || (status !== "conformant" && status !== "changed")) {
    throw new Error(`validated task outcome ${declaration.id} is invalid`);
  }
  return {
    id: declaration.id,
    model,
    task_id: requiredString(declaration, "task"),
    against_basis: requiredString(declaration, "against_basis"),
    status,
    summary: optionalString(declaration, "summary"),
    reason: requiredString(declaration, "reason"),
  };
}

function assuranceReceiptSemantic(
  declaration: DeclarationNode<TargetDeclarationKind>,
): HistoricalAssuranceReceiptSemanticV1 {
  const model = requiredField(declaration, "model").value;
  const outcome = requiredField(declaration, "outcome").value;
  const consumers = requiredField(declaration, "consumers").value;
  if (
    model !== 1 ||
    (outcome !== "conformant" && outcome !== "changed") ||
    !Array.isArray(consumers)
  ) {
    throw new Error(`validated assurance receipt ${declaration.id} is invalid`);
  }
  return {
    id: declaration.id,
    model,
    receipt_hash: requiredString(declaration, "receipt_hash"),
    producer_task_id: requiredString(declaration, "producer"),
    producer_contract_hash: requiredString(
      declaration,
      "producer_contract_hash",
    ),
    producer_assurance_hash: requiredString(
      declaration,
      "producer_assurance_hash",
    ),
    outcome,
    source_milestone_id: optionalString(declaration, "source_milestone"),
    consumers: (consumers as readonly AssuranceConsumerValue[])
      .map((consumer) => ({
        consumer_task_id: consumer.consumerTaskId,
        relation_mode: consumer.relationMode,
      }))
      .sort((left, right) => compareUnicodeScalars(
        left.consumer_task_id,
        right.consumer_task_id,
      )),
  };
}

function cloneRange(span: SourceSpan): HistoricalSourceRangeV1 {
  return {
    start: { ...span.start },
    end: { ...span.end },
  };
}

function sourceFidelity(
  validated: TargetGrammar6ValidatedDocument,
): HistoricalSourceFidelityV1 {
  return {
    source_digest: sha256DigestUtf8(validated.document.text) as Sha256Digest,
    utf16_length: validated.document.text.length,
    declarations: validated.document.declarations.map((declaration, ordinal) => ({
      kind: declaration.kind,
      id: declaration.id,
      ordinal: ordinal + 1,
      from_id: declaration.from ?? null,
      to_id: declaration.to ?? null,
      range: cloneRange(declaration.span),
      id_range: cloneRange(declaration.idSpan),
      fields: declaration.fields.map((field, fieldOrdinal) => ({
        name: field.name,
        ordinal: fieldOrdinal + 1,
        raw_value: field.rawValue,
        range: cloneRange(field.span),
        value_range: cloneRange(field.valueSpan),
        child_ranges: (field.children ?? []).map((child, childOrdinal) => ({
          name: child.name,
          ordinal: childOrdinal + 1,
          raw_value: child.rawValue,
          range: cloneRange(child.span),
          value_range: cloneRange(child.valueSpan),
        })),
      })),
    })),
  };
}

function projectAxisRecords(
  semantic: HistoricalTransitionSemanticModelV1,
): Readonly<Record<keyof HistoricalTransitionAxisDigestsV1, unknown>> {
  return {
    planning: {
      model: HISTORICAL_TRANSITION_MODEL_ID,
      project: {
        id: semantic.project.id,
        grammar_version: semantic.project.grammar_version,
        title: semantic.project.title,
        description: semantic.project.description,
        as_of: semantic.project.as_of,
        duration_unit: semantic.project.duration_unit,
        velocity: semantic.project.velocity,
        finish_milestone_id: semantic.project.finish_milestone_id,
        critical_epsilon: semantic.project.critical_epsilon,
        target_duration: semantic.project.target_duration,
      },
      resources: semantic.resources,
      milestones: semantic.milestones.map(({ state: _state, ...milestone }) =>
        milestone
      ),
      tasks: semantic.tasks.map(({ lifecycle: _lifecycle, ...task }) => task),
      gates: semantic.gates,
      task_relations: semantic.task_relations,
    },
    lifecycle: {
      model: HISTORICAL_TRANSITION_MODEL_ID,
      milestones: semantic.milestones.map(({ id, state }) => ({ id, state })),
      tasks: semantic.tasks.map(({ id, lifecycle }) => ({ id, lifecycle })),
    },
    actual_evidence: {
      model: HISTORICAL_TRANSITION_MODEL_ID,
      work_events: semantic.work_events,
    },
    governance: {
      model: HISTORICAL_TRANSITION_MODEL_ID,
      governance: semantic.project.governance,
    },
    assurance: {
      model: HISTORICAL_TRANSITION_MODEL_ID,
      plan_assurance: semantic.project.plan_assurance,
      task_relations: semantic.task_relations,
      plan_seals: semantic.plan_seals,
      task_outcomes: semantic.task_outcomes,
      assurance_receipts: semantic.assurance_receipts,
    },
    topology: {
      model: HISTORICAL_TRANSITION_MODEL_ID,
      milestones: semantic.milestones.map(({ id }) => ({ id })),
      tasks: semantic.tasks.map((task) => ({
        id: task.id,
        from_milestone_id: task.from_milestone_id,
        to_milestone_id: task.to_milestone_id,
      })),
      gates: semantic.gates.map((gate) => ({
        id: gate.id,
        from_milestone_id: gate.from_milestone_id,
        to_milestone_id: gate.to_milestone_id,
      })),
    },
  };
}

export function projectHistoricalTransitionModel(
  validated: TargetGrammar6ValidatedDocument,
): HistoricalTransitionProjectionV1 {
  const declarations = validated.document.declarations;
  const project = declarations.find(({ kind }) => kind === "project");
  if (project === undefined) throw new Error("validated document has no project");
  const sorted = <T extends { readonly id: string }>(values: readonly T[]): T[] =>
    [...values].sort((left, right) => compareUnicodeScalars(left.id, right.id));
  const semantic: HistoricalTransitionSemanticModelV1 = {
    model: HISTORICAL_TRANSITION_MODEL_ID,
    model_version: HISTORICAL_TRANSITION_MODEL_VERSION,
    project: projectSemantic(validated, project),
    resources: sorted(
      declarations.filter(({ kind }) => kind === "resource").map(resourceSemantic),
    ),
    milestones: sorted(
      declarations.filter(({ kind }) => kind === "milestone").map(milestoneSemantic),
    ),
    tasks: sorted(
      declarations.filter(({ kind }) => kind === "task").map(taskSemantic),
    ),
    gates: sorted(
      declarations.filter(({ kind }) => kind === "gate").map(gateSemantic),
    ),
    work_events: sorted(
      declarations.filter(({ kind }) => kind === "work_event")
        .map(workEventSemantic),
    ),
    task_relations: sorted(
      declarations.filter(({ kind }) => kind === "task_relation")
        .map(taskRelationSemantic),
    ),
    plan_seals: [...declarations.filter(({ kind }) => kind === "plan_seal")
      .map(planSealSemantic)].sort((left, right) =>
        compareUnicodeScalars(left.task_id, right.task_id)
      ),
    task_outcomes: sorted(
      declarations.filter(({ kind }) => kind === "task_outcome")
        .map(taskOutcomeSemantic),
    ),
    assurance_receipts: sorted(
      declarations.filter(({ kind }) => kind === "assurance_receipt")
        .map(assuranceReceiptSemantic),
    ),
  };
  const axes = projectAxisRecords(semantic);
  return deepFreeze({
    model_version: HISTORICAL_TRANSITION_MODEL_VERSION,
    semantic_digest: sha256Canonical(semantic),
    semantic,
    axes: {
      planning: sha256Canonical(axes.planning),
      lifecycle: sha256Canonical(axes.lifecycle),
      actual_evidence: sha256Canonical(axes.actual_evidence),
      governance: sha256Canonical(axes.governance),
      assurance: sha256Canonical(axes.assurance),
      topology: sha256Canonical(axes.topology),
    },
    source_fidelity: sourceFidelity(validated),
  });
}

export function historicalOccurrenceId(key: HistoricalOccurrenceKeyV1): string {
  if (
    key.projectId.length === 0 ||
    key.sourceId.length === 0 ||
    !(key.entityKind in entityKindOrder) ||
    !fullObjectIdPattern.test(key.introducedCommitId)
  ) {
    throw new Error("historical occurrence key is invalid");
  }
  const digest = sha256Canonical({
    projectId: key.projectId,
    entityKind: key.entityKind,
    sourceId: key.sourceId,
    introducedCommitId: key.introducedCommitId,
  });
  return `HDGE-${digest.slice("sha256:".length)}`;
}

export function historicalTopologyEpochId(
  entries: readonly HistoricalTopologyEntryV1[],
): string {
  const ordered = [...entries].sort((left, right) =>
    (left.entity_kind === right.entity_kind
      ? 0
      : left.entity_kind === "task"
        ? -1
        : 1) || compareUnicodeScalars(left.source_id, right.source_id)
  );
  const digest = sha256Canonical({
    model: HISTORICAL_TRANSITION_MODEL_ID,
    model_version: HISTORICAL_TRANSITION_MODEL_VERSION,
    topology: ordered,
  });
  return `HDGT-${digest.slice("sha256:".length)}`;
}

function changedAxes(
  previous: HistoricalTransitionProjectionV1,
  current: HistoricalTransitionProjectionV1,
): readonly (keyof HistoricalTransitionAxisDigestsV1)[] {
  const order: readonly (keyof HistoricalTransitionAxisDigestsV1)[] = [
    "planning",
    "lifecycle",
    "actual_evidence",
    "governance",
    "assurance",
    "topology",
  ];
  return order.filter((axis) => previous.axes[axis] !== current.axes[axis]);
}

function recordsById<T extends { readonly id: string }>(
  records: readonly T[],
): ReadonlyMap<string, T> {
  return new Map(records.map((record) => [record.id, record] as const));
}

function removedIds<T extends { readonly id: string }>(
  previous: readonly T[],
  current: readonly T[],
): readonly string[] {
  const currentIds = new Set(current.map(({ id }) => id));
  return previous.map(({ id }) => id).filter((id) => !currentIds.has(id));
}

function changedStableRecordIds<T extends { readonly id: string }>(
  previous: readonly T[],
  current: readonly T[],
): readonly string[] {
  const currentById = recordsById(current);
  return previous.flatMap((record) => {
    const candidate = currentById.get(record.id);
    return candidate !== undefined &&
        canonicalJson(record) !== canonicalJson(candidate)
      ? [record.id]
      : [];
  });
}

function validAdvanceCandidate(
  previous: HistoricalTransitionProjectionV1,
  current: HistoricalTransitionProjectionV1,
  candidate: HistoricalCanonicalAdvanceCandidateV1 | undefined,
): candidate is HistoricalCanonicalAdvanceCandidateV1 {
  return candidate !== undefined &&
    candidate.planner_version.length > 0 &&
    candidate.base_semantic_digest === previous.semantic_digest &&
    candidate.candidate.semantic_digest === current.semantic_digest &&
    candidate.complete &&
    !candidate.force_requested &&
    !candidate.owner_assertion_used &&
    !candidate.repository_proof_assumed &&
    !candidate.persistence_assumed;
}

function hasOnlyAdditions<T extends { readonly id: string }>(
  previous: readonly T[],
  current: readonly T[],
): boolean {
  const currentById = recordsById(current);
  return previous.every((record) => {
    const candidate = currentById.get(record.id);
    return candidate !== undefined && canonicalJson(record) === canonicalJson(candidate);
  });
}

function frozenTaskIds(
  semantic: HistoricalTransitionSemanticModelV1,
): ReadonlySet<string> {
  return new Set([
    ...semantic.work_events.map(({ task_id }) => task_id),
    ...semantic.task_outcomes.map(({ task_id }) => task_id),
    ...semantic.assurance_receipts.map(({ producer_task_id }) =>
      producer_task_id
    ),
  ]);
}

function frozenTaskPlanChanged(
  previous: HistoricalTransitionSemanticModelV1,
  current: HistoricalTransitionSemanticModelV1,
): boolean {
  const frozen = frozenTaskIds(previous);
  const previousTasks = recordsById(previous.tasks);
  const currentTasks = recordsById(current.tasks);
  for (const taskId of frozen) {
    const before = previousTasks.get(taskId);
    const after = currentTasks.get(taskId);
    if (before === undefined || after === undefined) return true;
    if (canonicalJson({
      from_milestone_id: before.from_milestone_id,
      to_milestone_id: before.to_milestone_id,
      plan: before.plan,
    }) !== canonicalJson({
      from_milestone_id: after.from_milestone_id,
      to_milestone_id: after.to_milestone_id,
      plan: after.plan,
    })) return true;
  }
  return false;
}

export function classifyHistoricalTransition(
  previous: HistoricalTransitionProjectionV1 | null,
  current: HistoricalTransitionProjectionV1,
  options: {
    readonly isMergeCommit?: boolean;
    readonly canonicalAdvanceCandidate?: HistoricalCanonicalAdvanceCandidateV1;
  } = {},
): HistoricalTransitionClassificationV1 {
  const isMergeCommit = options.isMergeCommit ?? false;
  if (previous === null) {
    return deepFreeze({
      class: "initial",
      causes: [],
      semantic_changed: true,
      source_changed: true,
      changed_axes: [
        "planning",
        "lifecycle",
        "actual_evidence",
        "governance",
        "assurance",
        "topology",
      ],
      is_merge_commit: isMergeCommit,
      canonical_advance: null,
    });
  }
  const axes = changedAxes(previous, current);
  const sourceChanged = previous.source_fidelity.source_digest !==
    current.source_fidelity.source_digest;
  if (previous.semantic_digest === current.semantic_digest) {
    return deepFreeze({
      class: "representation_only",
      causes: [],
      semantic_changed: false,
      source_changed: sourceChanged,
      changed_axes: [],
      is_merge_commit: isMergeCommit,
      canonical_advance: null,
    });
  }

  const previousSemantic = previous.semantic;
  const currentSemantic = current.semantic;
  const eventConflicts = changedStableRecordIds(
    previousSemantic.work_events,
    currentSemantic.work_events,
  );
  const immutableAssuranceConflicts = [
    ...changedStableRecordIds(
      previousSemantic.task_outcomes,
      currentSemantic.task_outcomes,
    ),
    ...changedStableRecordIds(
      previousSemantic.assurance_receipts,
      currentSemantic.assurance_receipts,
    ),
  ];
  if (
    previousSemantic.project.id !== currentSemantic.project.id ||
    eventConflicts.length > 0 ||
    immutableAssuranceConflicts.length > 0
  ) {
    return deepFreeze({
      class: "conflict",
      causes: eventConflicts.length > 0
        ? ["event_payload_changed"]
        : ["topology_conflict"],
      semantic_changed: true,
      source_changed: sourceChanged,
      changed_axes: axes,
      is_merge_commit: isMergeCommit,
      canonical_advance: null,
    });
  }

  if (validAdvanceCandidate(
    previous,
    current,
    options.canonicalAdvanceCandidate,
  )) {
    return deepFreeze({
      class: "canonical_advance",
      causes: [],
      semantic_changed: true,
      source_changed: sourceChanged,
      changed_axes: axes,
      is_merge_commit: isMergeCommit,
      canonical_advance: {
        planner_version: options.canonicalAdvanceCandidate.planner_version,
        candidate_semantic_digest:
          options.canonicalAdvanceCandidate.candidate.semantic_digest,
      },
    });
  }

  const removed = [
    ...removedIds(previousSemantic.resources, currentSemantic.resources),
    ...removedIds(previousSemantic.milestones, currentSemantic.milestones),
    ...removedIds(previousSemantic.tasks, currentSemantic.tasks),
    ...removedIds(previousSemantic.gates, currentSemantic.gates),
    ...removedIds(previousSemantic.work_events, currentSemantic.work_events),
    ...removedIds(previousSemantic.task_relations, currentSemantic.task_relations),
    ...previousSemantic.plan_seals
      .map(({ task_id }) => task_id)
      .filter((taskId) => !currentSemantic.plan_seals.some(
        ({ task_id }) => task_id === taskId,
      )),
    ...removedIds(previousSemantic.task_outcomes, currentSemantic.task_outcomes),
    ...removedIds(
      previousSemantic.assurance_receipts,
      currentSemantic.assurance_receipts,
    ),
  ];
  if (removed.length > 0) {
    return deepFreeze({
      class: "ambiguous_edit",
      causes: ["noncanonical_removal"],
      semantic_changed: true,
      source_changed: sourceChanged,
      changed_axes: axes,
      is_merge_commit: isMergeCommit,
      canonical_advance: null,
    });
  }

  if (frozenTaskPlanChanged(previousSemantic, currentSemantic)) {
    return deepFreeze({
      class: "conflict",
      causes: ["topology_conflict"],
      semantic_changed: true,
      source_changed: sourceChanged,
      changed_axes: axes,
      is_merge_commit: isMergeCommit,
      canonical_advance: null,
    });
  }

  const evidenceOnlyAdditions = hasOnlyAdditions(
    previousSemantic.work_events,
    currentSemantic.work_events,
  ) && hasOnlyAdditions(
    previousSemantic.task_outcomes,
    currentSemantic.task_outcomes,
  ) && hasOnlyAdditions(
    previousSemantic.assurance_receipts,
    currentSemantic.assurance_receipts,
  );
  const planningChanged = axes.includes("planning") ||
    axes.includes("governance") || axes.includes("topology");
  const lifecycleChanged = axes.includes("lifecycle");
  const evidenceChanged = axes.includes("actual_evidence") ||
    axes.includes("assurance");
  const classification: HistoricalTransitionClass =
    !planningChanged && !lifecycleChanged && evidenceChanged &&
        evidenceOnlyAdditions
      ? "evidence_extension"
      : !planningChanged && lifecycleChanged && evidenceOnlyAdditions
        ? "lifecycle_projection"
        : "future_plan_edit";
  return deepFreeze({
    class: classification,
    causes: [],
    semantic_changed: true,
    source_changed: sourceChanged,
    changed_axes: axes,
    is_merge_commit: isMergeCommit,
    canonical_advance: null,
  });
}

interface EntityRecord {
  readonly kind: HistoricalEntityKind;
  readonly id: string;
  readonly value: unknown;
  readonly fromId: string | null;
  readonly toId: string | null;
}

interface ActiveOccurrence {
  readonly occurrenceId: string | null;
  readonly valueDigest: Sha256Digest;
  readonly valueEpochOrdinal: number | null;
}

interface IdentityMemory {
  active: ActiveOccurrence | null;
  seen: boolean;
  uncertainWhileAbsent: boolean;
}

function entityRecords(
  semantic: HistoricalTransitionSemanticModelV1,
): readonly EntityRecord[] {
  return [
    ...semantic.milestones.map((value) => ({
      kind: "milestone" as const,
      id: value.id,
      value,
      fromId: null,
      toId: null,
    })),
    ...semantic.tasks.map((value) => ({
      kind: "task" as const,
      id: value.id,
      value,
      fromId: value.from_milestone_id,
      toId: value.to_milestone_id,
    })),
    ...semantic.gates.map((value) => ({
      kind: "gate" as const,
      id: value.id,
      value,
      fromId: value.from_milestone_id,
      toId: value.to_milestone_id,
    })),
    ...semantic.resources.map((value) => ({
      kind: "resource" as const,
      id: value.id,
      value,
      fromId: null,
      toId: null,
    })),
  ].sort(compareEntity);
}

function identityKey(kind: HistoricalEntityKind, id: string): string {
  return `${kind}\u0000${id}`;
}

function sequenceCauseKey(cause: HistoricalTransitionSequenceCauseV1): string {
  return [
    cause.cause,
    cause.commit_id,
    cause.entity_kind ?? "",
    cause.source_id ?? "",
  ].join("\u0000");
}

export function projectHistoricalTransitionSequence(
  inputs: readonly HistoricalTransitionSequenceInputV1[],
): HistoricalTransitionSequenceV1 {
  if (inputs.length === 0) {
    return deepFreeze({
      model_version: HISTORICAL_TRANSITION_MODEL_VERSION,
      checkpoints: [],
      causes: [],
    });
  }
  const commitIds = new Set<string>();
  for (const [index, input] of inputs.entries()) {
    if (
      !fullObjectIdPattern.test(input.commit_id) ||
      commitIds.has(input.commit_id) ||
      (index === 0 && input.connected_to_previous)
    ) {
      throw new Error("historical transition sequence input is invalid");
    }
    commitIds.add(input.commit_id);
  }

  const memory = new Map<string, IdentityMemory>();
  const causes: HistoricalTransitionSequenceCauseV1[] = [];
  const checkpoints: HistoricalTransitionSequenceCheckpointV1[] = [];
  let previous: HistoricalTransitionProjectionV1 | null = null;
  let previousEntityKeys = new Set<string>();

  for (const [index, input] of inputs.entries()) {
    const connected = index > 0 && input.connected_to_previous;
    const identityConnected = connected && previous !== null &&
      previous.semantic.project.id === input.projection.semantic.project.id;
    const transition = classifyHistoricalTransition(
      connected ? previous : null,
      input.projection,
      {
        isMergeCommit: input.is_merge_commit,
        ...(input.canonical_advance_candidate === undefined
          ? {}
          : { canonicalAdvanceCandidate: input.canonical_advance_candidate }),
      },
    );
    for (const cause of transition.causes) {
      causes.push({
        cause,
        commit_id: input.commit_id,
        entity_kind: null,
        source_id: null,
      });
    }
    const records = entityRecords(input.projection.semantic);
    const currentEntityKeys = new Set(
      records.map(({ kind, id }) => identityKey(kind, id)),
    );

    if (!identityConnected && index > 0) {
      for (const entry of memory.values()) {
        if (entry.seen) entry.uncertainWhileAbsent = true;
        entry.active = null;
      }
    } else if (connected) {
      for (const [key, entry] of memory) {
        if (previousEntityKeys.has(key) && !currentEntityKeys.has(key)) {
          entry.active = null;
          if (!trustworthyTransitionClasses.has(transition.class)) {
            entry.uncertainWhileAbsent = true;
          }
        } else if (
          entry.active === null &&
          entry.seen &&
          !trustworthyTransitionClasses.has(transition.class)
        ) {
          entry.uncertainWhileAbsent = true;
        }
      }
    }

    const epochs: HistoricalEntityValueEpochV1[] = [];
    const currentOccurrences = new Map<string, string | null>();
    for (const record of records) {
      const key = identityKey(record.kind, record.id);
      const valueDigest = sha256Canonical(record.value);
      const entry = memory.get(key) ?? {
        active: null,
        seen: false,
        uncertainWhileAbsent: false,
      };
      let active = entry.active;
      if (active === null) {
        const ambiguousOtherKind = [...memory.entries()].some(
          ([otherKey, other]) =>
            otherKey !== key &&
            otherKey.endsWith(`\u0000${record.id}`) &&
            other.seen &&
            (other.active !== null || other.uncertainWhileAbsent),
        );
        if (
          (entry.seen && entry.uncertainWhileAbsent) ||
          ambiguousOtherKind
        ) {
          active = {
            occurrenceId: null,
            valueDigest,
            valueEpochOrdinal: null,
          };
          causes.push({
            cause: "identity_ambiguous",
            commit_id: input.commit_id,
            entity_kind: record.kind,
            source_id: record.id,
          });
        } else {
          active = {
            occurrenceId: historicalOccurrenceId({
              projectId: input.projection.semantic.project.id,
              entityKind: record.kind,
              sourceId: record.id,
              introducedCommitId: input.commit_id,
            }),
            valueDigest,
            valueEpochOrdinal: 1,
          };
        }
      } else if (active.valueDigest !== valueDigest) {
        active = {
          occurrenceId: active.occurrenceId,
          valueDigest,
          valueEpochOrdinal: active.valueEpochOrdinal === null
            ? null
            : active.valueEpochOrdinal + 1,
        };
      }
      entry.active = active;
      entry.seen = true;
      entry.uncertainWhileAbsent = false;
      memory.set(key, entry);
      currentOccurrences.set(key, active.occurrenceId);
      epochs.push({
        entity_kind: record.kind,
        source_id: record.id,
        occurrence_id: active.occurrenceId,
        value_epoch_ordinal: active.valueEpochOrdinal,
        value_digest: active.valueDigest,
      });
    }

    const topologyEntries: HistoricalTopologyEntryV1[] = [];
    let topologyComplete = true;
    for (const record of records.filter(
      (candidate): candidate is EntityRecord & {
        readonly kind: "task" | "gate";
      } => candidate.kind === "task" || candidate.kind === "gate",
    )) {
      const occurrenceId = currentOccurrences.get(
        identityKey(record.kind, record.id),
      );
      const fromOccurrenceId = currentOccurrences.get(
        identityKey("milestone", record.fromId!),
      );
      const toOccurrenceId = currentOccurrences.get(
        identityKey("milestone", record.toId!),
      );
      if (
        occurrenceId === null || occurrenceId === undefined ||
        fromOccurrenceId === null || fromOccurrenceId === undefined ||
        toOccurrenceId === null || toOccurrenceId === undefined
      ) {
        topologyComplete = false;
        continue;
      }
      topologyEntries.push({
        entity_kind: record.kind,
        source_id: record.id,
        occurrence_id: occurrenceId,
        from_occurrence_id: fromOccurrenceId,
        to_occurrence_id: toOccurrenceId,
      });
    }
    checkpoints.push({
      commit_id: input.commit_id,
      semantic_digest: input.projection.semantic_digest,
      transition,
      entity_value_epochs: epochs,
      topology_epoch_id: topologyComplete
        ? historicalTopologyEpochId(topologyEntries)
        : null,
    });
    previous = input.projection;
    previousEntityKeys = currentEntityKeys;
  }

  const uniqueCauses = new Map(
    causes.map((cause) => [sequenceCauseKey(cause), cause] as const),
  );
  return deepFreeze({
    model_version: HISTORICAL_TRANSITION_MODEL_VERSION,
    checkpoints,
    causes: [...uniqueCauses.values()].sort((left, right) =>
      compareUnicodeScalars(left.commit_id, right.commit_id) ||
      compareUnicodeScalars(left.cause, right.cause) ||
      (left.entity_kind === null || right.entity_kind === null
        ? left.entity_kind === right.entity_kind
          ? 0
          : left.entity_kind === null
            ? -1
            : 1
        : entityKindOrder[left.entity_kind] - entityKindOrder[right.entity_kind]) ||
      compareUnicodeScalars(left.source_id ?? "", right.source_id ?? "")
    ),
  });
}
