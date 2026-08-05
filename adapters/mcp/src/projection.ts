import {
  convertWithVelocity,
  formatDecimal,
  recommendationAnalysisToJson,
  type Diagnostic,
  type DurationUnit,
  type Rational,
  type Velocity,
} from "perttool/node";
import type {
  analyzeDocument,
  checkDocument,
  selectNextTasks,
} from "perttool/node";

type CheckResult = ReturnType<typeof checkDocument>;
type AnalysisResult = ReturnType<typeof analyzeDocument>;
type NextResult = ReturnType<typeof selectNextTasks>;
type JsonObject = Readonly<Record<string, unknown>>;

type RationalUnit =
  | DurationUnit
  | "day^2"
  | "hour^2"
  | "point^2"
  | "ratio";

export function snakeJson(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(snakeJson);
  if (value instanceof Map) {
    return [...value.entries()].map(([key, item]) => ({
      key: snakeJson(key),
      value: snakeJson(item),
    }));
  }
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase(),
      snakeJson(item),
    ]),
  );
}

function positionJson(position: { readonly offset: number; readonly line: number; readonly column: number }) {
  return {
    offset: position.offset,
    line: position.line + 1,
    column: position.column + 1,
  };
}

export function diagnosticJson(diagnostic: Diagnostic): JsonObject {
  return {
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    entity_id: diagnostic.entityId ?? null,
    span: diagnostic.span === undefined
      ? null
      : {
          start: positionJson(diagnostic.span.start),
          end: positionJson(diagnostic.span.end),
        },
    related: (diagnostic.related ?? []).map((related) => ({
      message: related.message,
      span: {
        start: positionJson(related.span.start),
        end: positionJson(related.span.end),
      },
    })),
    help_topic: null,
    guide_topic: diagnostic.helpTopic ?? null,
    expected_syntax: diagnostic.expectedSyntax ?? null,
    fixes: [],
    data: snakeJson(diagnostic.data ?? {}),
  };
}

function rationalJson(
  value: Rational,
  unit: RationalUnit,
  precision: number,
): JsonObject {
  return {
    numerator: value.numerator.toString(),
    denominator: value.denominator.toString(),
    unit,
    display: formatDecimal(value, precision),
  };
}

function velocityJson(
  velocity: Velocity | null,
  precision: number,
): JsonObject | null {
  if (velocity === null) return null;
  return {
    points: rationalJson(velocity.points, "point", precision),
    period: rationalJson(velocity.period, velocity.periodUnit, precision),
  };
}

function precedenceJson(
  result: NonNullable<AnalysisResult["precedence"]>,
  unit: DurationUnit,
  precision: number,
): JsonObject {
  const varianceUnit = `${unit}^2` as "day^2" | "hour^2" | "point^2";
  const path = (value: typeof result.critical.representativePath) => ({
    edge_ids: value.edgeIds,
    task_ids: value.taskIds,
    gate_ids: value.gateIds,
    variance: rationalJson(value.variance, varianceUnit, precision),
  });
  return {
    makespan: rationalJson(result.makespan, unit, precision),
    conditional_on_blocks_resolved: result.conditionalOnBlocksResolved,
    blocked_task_ids: result.blockedTaskIds,
    conditional_on_suspensions_resumed: result.conditionalOnSuspensionsResumed,
    suspended_task_ids: result.suspendedTaskIds,
    milestones: result.milestones.map((milestone) => ({
      id: milestone.id,
      earliest: rationalJson(milestone.earliest, unit, precision),
      latest: rationalJson(milestone.latest, unit, precision),
      slack: rationalJson(milestone.slack, unit, precision),
    })),
    edges: result.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      kind: edge.kind,
      status: edge.status,
      expected: rationalJson(edge.expected, unit, precision),
      variance: rationalJson(edge.variance, varianceUnit, precision),
      es: rationalJson(edge.es, unit, precision),
      ef: rationalJson(edge.ef, unit, precision),
      ls: rationalJson(edge.ls, unit, precision),
      lf: rationalJson(edge.lf, unit, precision),
      total_float: rationalJson(edge.totalFloat, unit, precision),
      free_float: rationalJson(edge.freeFloat, unit, precision),
      is_critical: edge.isCritical,
      is_driving: edge.isDriving,
    })),
    critical: {
      milestone_ids: result.critical.milestoneIds,
      task_ids: result.critical.taskIds,
      gate_ids: result.critical.gateIds,
      driving_edge_ids: result.critical.drivingEdgeIds,
      representative_path: path(result.critical.representativePath),
      path_count: result.critical.pathCount.toString(),
      paths: result.critical.paths.map(path),
      paths_truncated: result.critical.pathsTruncated,
    },
  };
}

function resourceJson(
  result: NonNullable<AnalysisResult["resource"]>,
  unit: DurationUnit,
  precision: number,
): JsonObject {
  const varianceUnit = `${unit}^2` as "day^2" | "hour^2" | "point^2";
  const schedulePath = (path: typeof result.scheduleCritical.representativePath) => ({
    task_ids: path.taskIds,
    constraints: path.constraints.map((constraint) => ({
      from_task_id: constraint.fromTaskId,
      to_task_id: constraint.toTaskId,
      kind: constraint.kind,
      resource_arc_id: constraint.resourceArcId,
    })),
    connector_ids: path.connectorIds,
  });
  return {
    algorithm: result.algorithm,
    conditional_on_blocks_resolved: result.conditionalOnBlocksResolved,
    blocked_task_ids: result.blockedTaskIds,
    conditional_on_suspensions_resumed: result.conditionalOnSuspensionsResumed,
    suspended_task_ids: result.suspendedTaskIds,
    capacities: result.capacities.map((capacity) => ({
      id: capacity.id,
      declared: capacity.declared,
      override: capacity.override,
      effective: capacity.effective,
    })),
    precedence_lower_bound: rationalJson(result.precedenceLowerBound, unit, precision),
    makespan: rationalJson(result.makespan, unit, precision),
    resource_delay: rationalJson(result.resourceDelay, unit, precision),
    tasks: result.tasks.map((task) => ({
      id: task.id,
      status: task.status,
      expected: rationalJson(task.expected, unit, precision),
      variance: rationalJson(task.variance, varianceUnit, precision),
      eligible_time: rationalJson(task.eligibleTime, unit, precision),
      start: rationalJson(task.start, unit, precision),
      finish: rationalJson(task.finish, unit, precision),
      resource_wait: rationalJson(task.resourceWait, unit, precision),
      requirements: task.requirements.map((requirement) => ({
        resource_id: requirement.resourceId,
        units: requirement.units,
      })),
      priority_key: {
        priority: task.priorityKey.priority,
        precedence_total_float: rationalJson(
          task.priorityKey.precedenceTotalFloat,
          unit,
          precision,
        ),
        expected: rationalJson(task.priorityKey.expected, unit, precision),
        task_id: task.priorityKey.taskId,
      },
      conditional_blocked: task.conditionalBlocked,
    })),
    resources: result.resources.map((resource) => ({
      id: resource.id,
      capacity: resource.capacity,
      amount_time: rationalJson(resource.amountTime, unit, precision),
      utilization: rationalJson(resource.utilization, "ratio", precision),
      peak_usage: resource.peakUsage,
      last_release: rationalJson(resource.lastRelease, unit, precision),
      timeline: resource.timeline.map((entry) => ({
        task_id: entry.taskId,
        start: rationalJson(entry.start, unit, precision),
        finish: rationalJson(entry.finish, unit, precision),
        units: entry.units,
      })),
    })),
    resource_arcs: result.resourceArcs.map((arc) => ({
      id: arc.id,
      from_task_id: arc.fromTaskId,
      to_task_id: arc.toTaskId,
      at_time: rationalJson(arc.atTime, unit, precision),
      wait_from: rationalJson(arc.waitFrom, unit, precision),
      resources: [...arc.resources]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([resourceId, contributedUnits]) => ({
          resource_id: resourceId,
          contributed_units: contributedUnits,
        })),
      schedule_float: rationalJson(arc.scheduleFloat, unit, precision),
      is_critical: arc.isCritical,
      is_driving: arc.isDriving,
    })),
    constraint_graph_replay: result.constraintGraphReplay,
    schedule_critical: {
      task_ids: result.scheduleCritical.taskIds,
      resource_arc_ids: result.scheduleCritical.resourceArcIds,
      driving_constraint_ids: result.scheduleCritical.drivingConstraintIds,
      representative_path: schedulePath(result.scheduleCritical.representativePath),
      path_count: result.scheduleCritical.pathCount.toString(),
      paths: result.scheduleCritical.paths.map(schedulePath),
      paths_truncated: result.scheduleCritical.pathsTruncated,
    },
  };
}

function analysisVelocityForecastJson(result: AnalysisResult): JsonObject | null {
  const forecast = result.velocityForecast;
  if (forecast === null) return null;
  return {
    qualifier: forecast.qualifier,
    source_unit: forecast.sourceUnit,
    target_unit: forecast.targetUnit,
    precedence_makespan: result.precedence === null
      ? null
      : rationalJson(
          convertWithVelocity(result.precedence.makespan, forecast),
          forecast.targetUnit,
          result.precision,
        ),
    resource_makespan: result.resource === null
      ? null
      : rationalJson(
          convertWithVelocity(result.resource.makespan, forecast),
          forecast.targetUnit,
          result.precision,
        ),
  };
}

type WorkEvent = NonNullable<CheckResult["actualsInputs"]>["events"][number];

function quantityJson(
  quantity: WorkEvent["plannedValue"] | WorkEvent["activeTime"] | WorkEvent["effort"],
  unit: "day" | "hour" | "point" | "person_hour",
): JsonObject | null {
  if (quantity === null) return null;
  return {
    numerator: quantity.value.numerator.toString(),
    denominator: quantity.value.denominator.toString(),
    unit,
    display: formatDecimal(quantity.value, 6),
  };
}

function workEventJson(event: WorkEvent): unknown {
  const occurredAt = {
    kind: event.occurredAt.kind,
    source_text: event.occurredAt.sourceText,
    year: event.occurredAt.year,
    month: event.occurredAt.month,
    day: event.occurredAt.day,
    hour: event.occurredAt.hour,
    minute: event.occurredAt.minute,
    second: {
      numerator: event.occurredAt.second.numerator.toString(),
      denominator: event.occurredAt.second.denominator.toString(),
    },
    offset_minutes: event.occurredAt.offsetMinutes,
  };
  return {
    model_version: event.model,
    id: event.id,
    task_id: event.taskId,
    kind: event.kind,
    occurred_at: occurredAt,
    planned_value: event.plannedValue === null
      ? null
      : quantityJson(event.plannedValue, event.plannedValue.unit),
    active_time: quantityJson(event.activeTime, "hour"),
    effort: quantityJson(event.effort, "person_hour"),
    reason: event.reason,
  };
}

export function projectCheckResult(result: CheckResult): JsonObject {
  return Object.freeze({
    ok: result.ok,
    document_id: result.documentId,
    diagnostics: result.diagnostics.map(diagnosticJson),
    diagnostics_truncated: result.diagnosticsTruncated,
    grammar_version: result.grammarVersion,
    summary: result.summary,
    temporal_inputs: snakeJson(result.temporalInputs),
    actuals_inputs: result.actualsInputs === null
      ? null
      : {
          model_version: result.actualsInputs.modelVersion,
          events: result.actualsInputs.events.map(workEventJson),
        },
    assurance: snakeJson(result.assurance),
    assurance_state_counts: snakeJson(result.assuranceStateCounts),
  });
}

export function projectAnalysisResult(result: AnalysisResult): JsonObject {
  return Object.freeze({
    ok: result.ok,
    document_id: result.documentId,
    diagnostics: result.diagnostics.map(diagnosticJson),
    diagnostics_truncated: result.diagnosticsTruncated,
    grammar_version: result.grammarVersion,
    task_actuals: result.taskActuals.map((actuals) => ({
      task_id: actuals.taskId,
      status: actuals.status,
      coverage: actuals.coverage,
    })),
    mode: result.mode,
    precision: result.precision,
    ...(result.durationUnit === null
      ? {}
      : {
          duration_unit: result.durationUnit,
          critical_epsilon: rationalJson(
            result.criticalEpsilon!,
            result.durationUnit,
            result.precision,
          ),
          velocity: velocityJson(result.velocity, result.precision),
          velocity_forecast: analysisVelocityForecastJson(result),
        }),
    precedence: result.precedence === null || result.durationUnit === null
      ? null
      : precedenceJson(result.precedence, result.durationUnit, result.precision),
    resource: result.resource === null || result.durationUnit === null
      ? null
      : resourceJson(result.resource, result.durationUnit, result.precision),
    temporal: snakeJson(result.temporal),
    assurance: snakeJson(result.assurance),
  });
}

function explanationJson(
  node: NextResult["tasks"][number]["explanation"][number],
): JsonObject {
  return {
    milestone_id: node.milestoneId,
    reached: node.reached,
    unsatisfied_edges: node.unsatisfiedEdges.map((edge) => ({
      edge_id: edge.edgeId,
      kind: edge.kind,
      status: edge.status,
      source_milestone_id: edge.sourceMilestoneId,
      source_reached: edge.sourceReached,
    })),
    children: node.children.map(explanationJson),
    truncated: node.truncated,
  };
}

export function projectNextResult(result: NextResult): JsonObject {
  const common = {
    ok: result.ok,
    document_id: result.documentId,
    diagnostics: result.diagnostics.map(diagnosticJson),
    diagnostics_truncated: result.diagnosticsTruncated,
    grammar_version: result.grammarVersion,
    temporal: snakeJson(result.temporal),
    assurance: snakeJson(result.assurance),
  };
  if (result.durationUnit === null || result.recommendation === null) {
    return Object.freeze(common);
  }
  const unit = result.durationUnit;
  return Object.freeze({
    ...common,
    precision: result.precision,
    duration_unit: unit,
    velocity: velocityJson(result.velocity, result.precision),
    velocity_forecast: result.velocityForecast === null
      ? null
      : {
          qualifier: result.velocityForecast.qualifier,
          source_unit: result.velocityForecast.sourceUnit,
          target_unit: result.velocityForecast.targetUnit,
        },
    capacity_overrides: [...result.capacityOverrides]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([resourceId, capacity]) => ({ resource_id: resourceId, capacity })),
    recommendation: recommendationAnalysisToJson(result.recommendation),
    groups: {
      active: result.groups.active,
      ready: result.groups.ready,
      runnable_now: result.groups.runnableNow,
      blocked_now: result.groups.blockedNow,
      upcoming: result.groups.upcoming,
      suspended: result.groups.suspended,
    },
    tasks: result.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      classification: task.classification,
      runnable_now: task.runnableNow,
      priority: task.priority,
      owner: task.owner,
      blocked_reason: task.blockedReason,
      expected: rationalJson(task.expected, unit, result.precision),
      total_float: rationalJson(task.totalFloat, unit, result.precision),
      earliest_start: rationalJson(task.earliestStart, unit, result.precision),
      forecast_expected: task.forecastExpected === null || result.velocityForecast === null
        ? null
        : rationalJson(
            task.forecastExpected,
            result.velocityForecast.targetUnit,
            result.precision,
          ),
      forecast_total_float: task.forecastTotalFloat === null || result.velocityForecast === null
        ? null
        : rationalJson(
            task.forecastTotalFloat,
            result.velocityForecast.targetUnit,
            result.precision,
          ),
      forecast_earliest_start: task.forecastEarliestStart === null || result.velocityForecast === null
        ? null
        : rationalJson(
            task.forecastEarliestStart,
            result.velocityForecast.targetUnit,
            result.precision,
          ),
      precedence_critical: task.precedenceCritical,
      schedule_critical: task.scheduleCritical,
      requirements: task.requirements.map((requirement) => ({
        resource_id: requirement.resourceId,
        units: requirement.units,
      })),
      resource_rejections: task.resourceRejections.map((rejection) => ({
        resource_id: rejection.resourceId,
        capacity: rejection.capacity,
        active_usage: rejection.activeUsage,
        earlier_selected_usage: rejection.earlierSelectedUsage,
        used_before_decision: rejection.usedBeforeDecision,
        required: rejection.required,
        available: rejection.available,
        deficit: rejection.deficit,
        active_task_ids: rejection.activeTaskIds,
        earlier_selected_task_ids: rejection.earlierSelectedTaskIds,
      })),
      explanation: task.explanation.map(explanationJson),
    })),
  });
}

const facadeFields = new Set([
  "schema_version",
  "cli_contract_version",
  "recommendation_interface_version",
  "tool_version",
  "operation",
  "source",
  "source_digest",
]);

export function stripFacadeFields(value: JsonObject): JsonObject {
  return Object.freeze(Object.fromEntries(
    Object.entries(value).filter(([key]) => !facadeFields.has(key)),
  ));
}
