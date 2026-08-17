import { compareStableStrings } from "../model/diagnostics.js";
import type { Rational } from "../model/rational.js";
import {
  ZERO,
  add,
  compare,
  divide,
  maximum,
  minimum,
  multiply,
  rational,
  subtract,
} from "../model/rational.js";
import {
  effectiveCapacityAt,
  nextBoundary,
  projectOpenAt,
  resourceCapacitySpans,
  taskChangeBoundaries,
} from "./calendar.js";
import {
  temporalScheduleSourceModel,
} from "./source.js";
import type { TemporalScheduleSourceModel } from "./source-types.js";
import type {
  CalendarScheduleCause,
  CalendarScheduleProfile,
  CalendarSchedulerInput,
  CalendarSchedulerResult,
  CalendarVelocityInput,
  ResourceUtilization,
  ScheduledMilestone,
  ScheduledTask,
  SchedulerEdgeInput,
  SchedulerRequirement,
  SchedulerResourceInput,
  SchedulerTaskInput,
  TemporalScheduleSchedulerCapability,
  WorkingTimeResult,
  WorkSecondsResult,
  WorkSegment,
} from "./scheduler-types.js";

export const TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY:
  TemporalScheduleSchedulerCapability = Object.freeze({
    id: "perttool.target-grammar-8-calendar-scheduler",
    version: 1,
  });

export const TEMPORAL_SCHEDULE_SCHEDULER_LIMITS = Object.freeze({
  workSegments: 1_000_000,
  scheduleEvents: 1_000_000,
});

const PRECEDENCE_IDENTITY = Object.freeze({
  id: "perttool.temporal-precedence-earliest" as const,
  version: 2 as const,
  optimal: null,
});
const RESOURCE_IDENTITY = Object.freeze({
  id: "perttool.temporal-parallel-sgs" as const,
  version: 2 as const,
  optimal: false as const,
});
const SECONDS_PER_HOUR = rational(3_600n);

function cause(
  code: CalendarScheduleCause["code"],
  taskIds: readonly string[] = [],
  resourceIds: readonly string[] = [],
  limit: number | null = null,
): CalendarScheduleCause {
  return Object.freeze({
    code,
    taskIds: Object.freeze([...taskIds].sort(compareStableStrings)),
    resourceIds: Object.freeze([...resourceIds].sort(compareStableStrings)),
    limit,
  });
}

function unavailableWorking(
  value: CalendarScheduleCause,
): WorkingTimeResult {
  return Object.freeze({
    state: "unavailable",
    value: null,
    segments: Object.freeze([]),
    unavailableCauses: Object.freeze([value]),
  });
}

function resourceMap(
  resources: readonly SchedulerResourceInput[],
  overrides: ReadonlyMap<string, number>,
): ReadonlyMap<string, number> {
  const result = new Map<string, number>();
  for (const resource of resources) {
    if (result.has(resource.id) || !Number.isSafeInteger(resource.capacity) || resource.capacity < 0) {
      throw new TypeError(`invalid scheduler resource ${resource.id}`);
    }
    const value = overrides.get(resource.id) ?? resource.capacity;
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new TypeError(`invalid scheduler capacity override ${resource.id}`);
    }
    result.set(resource.id, value);
  }
  for (const id of overrides.keys()) {
    if (!result.has(id)) throw new TypeError(`unknown scheduler capacity override ${id}`);
  }
  return result;
}

function validateRequirements(
  requirements: readonly SchedulerRequirement[],
  capacities: ReadonlyMap<string, number>,
): void {
  const seen = new Set<string>();
  for (const requirement of requirements) {
    if (
      seen.has(requirement.resourceId) ||
      !capacities.has(requirement.resourceId) ||
      !Number.isSafeInteger(requirement.units) ||
      requirement.units <= 0
    ) throw new TypeError(`invalid scheduler requirement ${requirement.resourceId}`);
    seen.add(requirement.resourceId);
  }
}

function progressingAt(
  model: TemporalScheduleSourceModel,
  requirements: readonly SchedulerRequirement[],
  capacities: ReadonlyMap<string, number>,
  instant: Rational,
): boolean | null {
  if (requirements.length === 0) return projectOpenAt(model, instant);
  for (const requirement of requirements) {
    const capacity = effectiveCapacityAt(
      model,
      requirement.resourceId,
      capacities.get(requirement.resourceId)!,
      instant,
    );
    if (capacity === null) return null;
    if (capacity < requirement.units) return false;
  }
  return true;
}

function appendSegment(
  segments: WorkSegment[],
  start: Rational,
  end: Rational,
): void {
  if (compare(start, end) >= 0) return;
  const previous = segments.at(-1);
  if (previous !== undefined && compare(previous.end, start) === 0) {
    segments[segments.length - 1] = Object.freeze({ start: previous.start, end });
  } else {
    segments.push(Object.freeze({ start, end }));
  }
}

function forwardWork(
  model: TemporalScheduleSourceModel,
  requirements: readonly SchedulerRequirement[],
  capacities: ReadonlyMap<string, number>,
  start: Rational,
  work: Rational,
  horizonEnd: Rational,
): WorkingTimeResult {
  if (compare(work, ZERO) <= 0) throw new TypeError("working duration must be positive");
  const boundaries = taskChangeBoundaries(
    model,
    requirements.map(({ resourceId }) => resourceId),
    start,
    horizonEnd,
  );
  if (boundaries === null) return unavailableWorking(cause("zone_range_exceeded"));
  let remaining = work;
  const segments: WorkSegment[] = [];
  for (let index = 0; index + 1 < boundaries.length; index += 1) {
    const left = boundaries[index]!;
    const right = boundaries[index + 1]!;
    const progresses = progressingAt(model, requirements, capacities, left);
    if (progresses === null) return unavailableWorking(cause("zone_range_exceeded"));
    if (!progresses) continue;
    const available = subtract(right, left);
    const consumed = minimum(remaining, available);
    const finish = add(left, consumed);
    appendSegment(segments, left, finish);
    remaining = subtract(remaining, consumed);
    if (compare(remaining, ZERO) === 0) {
      return Object.freeze({
        state: "available",
        value: finish,
        segments: Object.freeze(segments),
        unavailableCauses: Object.freeze([]),
      });
    }
    if (segments.length >= TEMPORAL_SCHEDULE_SCHEDULER_LIMITS.workSegments) {
      return unavailableWorking(cause(
        "calendar_search_limit", [], [],
        TEMPORAL_SCHEDULE_SCHEDULER_LIMITS.workSegments,
      ));
    }
  }
  const everOpen = boundaries.slice(0, -1).some((value) =>
    progressingAt(model, requirements, capacities, value) === true);
  return unavailableWorking(cause(
    everOpen ? "calendar_search_limit" : "no_feasible_window",
    [], requirements.map(({ resourceId }) => resourceId),
    everOpen ? TEMPORAL_SCHEDULE_SCHEDULER_LIMITS.scheduleEvents : null,
  ));
}

function backwardWork(
  model: TemporalScheduleSourceModel,
  requirements: readonly SchedulerRequirement[],
  capacities: ReadonlyMap<string, number>,
  end: Rational,
  work: Rational,
  horizonStart: Rational,
): WorkingTimeResult {
  if (compare(work, ZERO) <= 0) throw new TypeError("working duration must be positive");
  const boundaries = taskChangeBoundaries(
    model,
    requirements.map(({ resourceId }) => resourceId),
    horizonStart,
    end,
  );
  if (boundaries === null) return unavailableWorking(cause("zone_range_exceeded"));
  let remaining = work;
  const reverse: WorkSegment[] = [];
  for (let index = boundaries.length - 1; index > 0; index -= 1) {
    const left = boundaries[index - 1]!;
    const right = boundaries[index]!;
    const progresses = progressingAt(model, requirements, capacities, left);
    if (progresses === null) return unavailableWorking(cause("zone_range_exceeded"));
    if (!progresses) continue;
    const available = subtract(right, left);
    const consumed = minimum(remaining, available);
    const start = subtract(right, consumed);
    reverse.push(Object.freeze({ start, end: right }));
    remaining = subtract(remaining, consumed);
    if (compare(remaining, ZERO) === 0) {
      const segments = reverse.reverse();
      return Object.freeze({
        state: "available",
        value: start,
        segments: Object.freeze(segments),
        unavailableCauses: Object.freeze([]),
      });
    }
  }
  return unavailableWorking(cause("calendar_search_limit", [], [],
    TEMPORAL_SCHEDULE_SCHEDULER_LIMITS.scheduleEvents));
}

export function addCalendarWorkingTime(
  source: import("./source-types.js").TemporalScheduleSourceResult,
  requirements: readonly SchedulerRequirement[],
  resources: readonly SchedulerResourceInput[],
  start: Rational,
  work: Rational,
  horizonEnd: Rational,
  capability: TemporalScheduleSchedulerCapability,
  capacityOverrides: ReadonlyMap<string, number> = new Map(),
): WorkingTimeResult {
  const model = checkedModel(source, capability);
  const capacities = resourceMap(resources, capacityOverrides);
  validateRequirements(requirements, capacities);
  return forwardWork(model, requirements, capacities, start, work, horizonEnd);
}

export function subtractCalendarWorkingTime(
  source: import("./source-types.js").TemporalScheduleSourceResult,
  requirements: readonly SchedulerRequirement[],
  resources: readonly SchedulerResourceInput[],
  end: Rational,
  work: Rational,
  horizonStart: Rational,
  capability: TemporalScheduleSchedulerCapability,
  capacityOverrides: ReadonlyMap<string, number> = new Map(),
): WorkingTimeResult {
  const model = checkedModel(source, capability);
  const capacities = resourceMap(resources, capacityOverrides);
  validateRequirements(requirements, capacities);
  return backwardWork(model, requirements, capacities, end, work, horizonStart);
}

function checkedModel(
  source: import("./source-types.js").TemporalScheduleSourceResult,
  capability: TemporalScheduleSchedulerCapability,
): TemporalScheduleSourceModel {
  if (capability !== TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY) {
    throw new TypeError("the calendar scheduler capability is required");
  }
  return temporalScheduleSourceModel(source);
}

export function calendarWorkSeconds(
  source: import("./source-types.js").TemporalScheduleSourceResult,
  value: Rational,
  unit: "hour" | "day" | "point",
  velocity: CalendarVelocityInput | null,
  capability: TemporalScheduleSchedulerCapability,
): WorkSecondsResult {
  const model = checkedModel(source, capability);
  if (compare(value, ZERO) <= 0) throw new TypeError("calendar work must be positive");
  const workday = model.profile.kind === "named_zone" ? model.profile.workdayHours : null;
  let hours: Rational | null = null;
  if (unit === "hour") hours = value;
  if (unit === "day" && workday !== null) hours = multiply(value, workday);
  if (unit === "point" && velocity !== null && compare(velocity.points, ZERO) > 0 &&
      compare(velocity.period, ZERO) > 0) {
    const periods = divide(value, velocity.points);
    hours = velocity.periodUnit === "hour"
      ? multiply(periods, velocity.period)
      : workday === null ? null : multiply(multiply(periods, velocity.period), workday);
  }
  return hours === null
    ? Object.freeze({
        state: "unavailable" as const,
        seconds: null,
        unavailableCauses: Object.freeze([cause("workday_relationship_missing")]),
      })
    : Object.freeze({
        state: "available" as const,
        seconds: multiply(hours, SECONDS_PER_HOUR),
        unavailableCauses: Object.freeze([]),
      });
}

interface GraphIndex {
  readonly tasks: readonly SchedulerTaskInput[];
  readonly gates: readonly Extract<SchedulerEdgeInput, { kind: "gate" }>[];
  readonly incoming: ReadonlyMap<string, readonly SchedulerEdgeInput[]>;
  readonly outgoing: ReadonlyMap<string, readonly SchedulerEdgeInput[]>;
  readonly order: readonly string[];
}

function graphIndex(input: CalendarSchedulerInput): GraphIndex {
  const milestoneIds = new Set(input.milestoneIds);
  if (!milestoneIds.has(input.finishMilestoneId)) throw new TypeError("unknown finish milestone");
  const edgeIds = new Set<string>();
  const incoming = new Map(input.milestoneIds.map((id) => [id, [] as SchedulerEdgeInput[]]));
  const outgoing = new Map(input.milestoneIds.map((id) => [id, [] as SchedulerEdgeInput[]]));
  for (const edge of input.edges) {
    if (edgeIds.has(edge.id) || !milestoneIds.has(edge.source) || !milestoneIds.has(edge.target)) {
      throw new TypeError(`invalid scheduler edge ${edge.id}`);
    }
    edgeIds.add(edge.id);
    incoming.get(edge.target)!.push(edge);
    outgoing.get(edge.source)!.push(edge);
  }
  const indegree = new Map(input.milestoneIds.map((id) => [id, incoming.get(id)!.length]));
  const available = [...indegree].filter(([, count]) => count === 0)
    .map(([id]) => id).sort(compareStableStrings);
  const order: string[] = [];
  while (available.length > 0) {
    const id = available.shift()!;
    order.push(id);
    for (const edge of outgoing.get(id)!) {
      const count = indegree.get(edge.target)! - 1;
      indegree.set(edge.target, count);
      if (count === 0) {
        available.push(edge.target);
        available.sort(compareStableStrings);
      }
    }
  }
  if (order.length !== input.milestoneIds.length) throw new TypeError("scheduler graph contains a cycle");
  return Object.freeze({
    tasks: Object.freeze(input.edges.filter((edge): edge is SchedulerTaskInput => edge.kind === "task")),
    gates: Object.freeze(input.edges.filter((edge): edge is Extract<SchedulerEdgeInput, { kind: "gate" }> => edge.kind === "gate")),
    incoming,
    outgoing,
    order: Object.freeze(order),
  });
}

function scheduledTask(
  task: SchedulerTaskInput,
  remaining: Rational,
  start: Rational,
  finish: Rational,
  segments: readonly WorkSegment[],
  eligible: Rational,
): ScheduledTask {
  return Object.freeze({
    id: task.id,
    status: task.status,
    expectedWorkSeconds: task.expectedWorkSeconds,
    remainingWorkSeconds: remaining,
    start,
    finish,
    segments: Object.freeze(segments),
    requirements: Object.freeze([...task.requirements]),
    resourceWaitSeconds: subtract(start, eligible),
    conditionalBlocked: task.status === "blocked",
  });
}

function unavailableProfile(
  algorithm: typeof PRECEDENCE_IDENTITY | typeof RESOURCE_IDENTITY,
  causes: readonly CalendarScheduleCause[],
): CalendarScheduleProfile {
  return Object.freeze({
    state: "unavailable",
    algorithm,
    makespanSeconds: null,
    tasks: Object.freeze([]),
    milestones: Object.freeze([]),
    utilization: Object.freeze([]),
    unavailableCauses: Object.freeze(causes),
  });
}

function notApplicable(
  algorithm: typeof PRECEDENCE_IDENTITY | typeof RESOURCE_IDENTITY,
): CalendarScheduleProfile {
  return Object.freeze({
    state: "not_applicable",
    algorithm,
    makespanSeconds: null,
    tasks: Object.freeze([]),
    milestones: Object.freeze([]),
    utilization: Object.freeze([]),
    unavailableCauses: Object.freeze([cause("calendar_profile_absent")]),
  });
}

function precedenceMilestoneReach(
  milestoneId: string,
  graph: GraphIndex,
  reached: ReadonlyMap<string, Rational>,
  satisfied: ReadonlyMap<string, Rational>,
  asOf: Rational,
): Rational | null {
  const existing = reached.get(milestoneId);
  if (existing !== undefined) return existing;
  const values = graph.incoming.get(milestoneId)!.map((edge) => satisfied.get(edge.id));
  const complete = values.filter((value): value is Rational => value !== undefined);
  return values.length > 0 && complete.length === values.length
    ? complete.reduce((result, value) => maximum(result, value), asOf)
    : null;
}

function precedenceTaskRecord(
  model: TemporalScheduleSourceModel,
  edge: SchedulerTaskInput,
  capacities: ReadonlyMap<string, number>,
  milestoneTime: Rational,
  input: CalendarSchedulerInput,
): Readonly<{ record: ScheduledTask | null; finish: Rational | null; causes: readonly CalendarScheduleCause[] }> {
  if (edge.status === "done") {
    return Object.freeze({
      record: scheduledTask(edge, ZERO, input.asOf, input.asOf, [], input.asOf),
      finish: input.asOf,
      causes: Object.freeze([]),
    });
  }
  const remaining = edge.status === "active"
    ? edge.remainingWorkSeconds ?? edge.expectedWorkSeconds
    : edge.expectedWorkSeconds;
  const eligible = edge.status === "active" ? input.asOf : milestoneTime;
  const work = forwardWork(model, edge.requirements, capacities, eligible, remaining, input.horizonEnd);
  if (work.state === "unavailable") {
    return Object.freeze({ record: null, finish: null, causes: work.unavailableCauses });
  }
  return Object.freeze({
    record: scheduledTask(edge, remaining, work.segments[0]!.start, work.value!, work.segments, eligible),
    finish: work.value,
    causes: Object.freeze([]),
  });
}

function precedenceSchedule(
  model: TemporalScheduleSourceModel,
  input: CalendarSchedulerInput,
  graph: GraphIndex,
  capacities: ReadonlyMap<string, number>,
): CalendarScheduleProfile {
  const reached = new Map(input.frontierMilestoneIds.map((id) => [id, input.asOf]));
  const satisfied = new Map<string, Rational>();
  const tasks: ScheduledTask[] = [];
  for (const milestoneId of graph.order) {
    const milestoneTime = precedenceMilestoneReach(
      milestoneId, graph, reached, satisfied, input.asOf,
    );
    if (milestoneTime === null) continue;
    reached.set(milestoneId, milestoneTime);
    for (const edge of graph.outgoing.get(milestoneId)!) {
      if (edge.kind === "gate") {
        satisfied.set(edge.id, milestoneTime);
        continue;
      }
      const projected = precedenceTaskRecord(model, edge, capacities, milestoneTime, input);
      if (projected.record === null || projected.finish === null) {
        return unavailableProfile(PRECEDENCE_IDENTITY, projected.causes);
      }
      satisfied.set(edge.id, projected.finish);
      tasks.push(projected.record);
    }
  }
  const makespan = reached.get(input.finishMilestoneId);
  if (makespan === undefined) return unavailableProfile(PRECEDENCE_IDENTITY, [cause("no_feasible_window")]);
  return Object.freeze({
    state: "available",
    algorithm: PRECEDENCE_IDENTITY,
    makespanSeconds: makespan,
    tasks: Object.freeze(tasks),
    milestones: Object.freeze(graph.order.flatMap((id) => {
      const reach = reached.get(id);
      return reach === undefined ? [] : [Object.freeze({ id, reach })];
    })),
    utilization: Object.freeze([]),
    unavailableCauses: Object.freeze([]),
  });
}

interface RuntimeTask {
  readonly input: SchedulerTaskInput;
  remaining: Rational;
  firstStart: Rational | null;
  eligible: Rational | null;
  started: boolean;
  completed: boolean;
  segments: WorkSegment[];
}

function taskOrder(left: RuntimeTask, right: RuntimeTask): number {
  if (left.input.status === "active" && right.input.status !== "active") return -1;
  if (right.input.status === "active" && left.input.status !== "active") return 1;
  if (left.started !== right.started) return left.started ? -1 : 1;
  if (left.input.priority !== right.input.priority) return right.input.priority - left.input.priority;
  const byFloat = compare(left.input.totalFloat, right.input.totalFloat);
  if (byFloat !== 0) return byFloat;
  const byDuration = compare(right.input.expectedWorkSeconds, left.input.expectedWorkSeconds);
  return byDuration !== 0 ? byDuration : compareStableStrings(left.input.id, right.input.id);
}

function canAllocate(
  model: TemporalScheduleSourceModel,
  task: RuntimeTask,
  capacities: ReadonlyMap<string, number>,
  usage: ReadonlyMap<string, number>,
  instant: Rational,
): boolean | null {
  if (task.input.requirements.length === 0) return projectOpenAt(model, instant);
  for (const requirement of task.input.requirements) {
    const capacity = effectiveCapacityAt(model, requirement.resourceId,
      capacities.get(requirement.resourceId)!, instant);
    if (capacity === null) return null;
    if ((usage.get(requirement.resourceId) ?? 0) + requirement.units > capacity) return false;
  }
  return true;
}

function allocate(
  task: RuntimeTask,
  usage: Map<string, number>,
): void {
  for (const requirement of task.input.requirements) {
    usage.set(requirement.resourceId,
      (usage.get(requirement.resourceId) ?? 0) + requirement.units);
  }
}

function propagateReached(
  graph: GraphIndex,
  reached: Map<string, Rational>,
  satisfied: ReadonlyMap<string, Rational>,
): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (const gate of graph.gates) {
      const source = reached.get(gate.source);
      if (source !== undefined && !satisfied.has(gate.id)) {
        (satisfied as Map<string, Rational>).set(gate.id, source);
        changed = true;
      }
    }
    for (const milestone of graph.order) {
      if (reached.has(milestone)) continue;
      const values = graph.incoming.get(milestone)!.map((edge) => satisfied.get(edge.id));
      if (values.length > 0 && values.every((value) => value !== undefined)) {
        reached.set(milestone, values.reduce((result, value) => maximum(result, value!), ZERO));
        changed = true;
      }
    }
  }
}

function activeConflict(
  model: TemporalScheduleSourceModel,
  runtime: readonly RuntimeTask[],
  capacities: ReadonlyMap<string, number>,
  instant: Rational,
): CalendarScheduleCause | null {
  const active = runtime.filter(({ input }) => input.status === "active");
  const usage = new Map<string, number>();
  for (const task of active) {
    if (progressingAt(model, task.input.requirements, capacities, instant) !== true) continue;
    for (const requirement of task.input.requirements) {
      usage.set(requirement.resourceId, (usage.get(requirement.resourceId) ?? 0) + requirement.units);
    }
  }
  const conflicts = [...usage].filter(([id, units]) => units > effectiveCapacityAt(
    model, id, capacities.get(id)!, instant)!).map(([id]) => id);
  return conflicts.length === 0 ? null : cause(
    "active_capacity_conflict", active.map(({ input }) => input.id), conflicts,
  );
}

function utilization(
  model: TemporalScheduleSourceModel,
  input: CalendarSchedulerInput,
  capacities: ReadonlyMap<string, number>,
  tasks: readonly ScheduledTask[],
  makespan: Rational,
): readonly ResourceUtilization[] {
  return Object.freeze(input.resources.map((resource) => {
    const spans = resourceCapacitySpans(model, resource.id, capacities.get(resource.id)!, input.asOf, makespan) ?? [];
    const available = spans.reduce((sum, span) => add(sum,
      multiply(subtract(span.end, span.start), rational(BigInt(span.capacity)))), ZERO);
    const allocated = tasks.reduce((sum, task) => {
      const units = task.requirements.find(({ resourceId }) => resourceId === resource.id)?.units ?? 0;
      return task.segments.reduce((inner, segment) => add(inner,
        multiply(subtract(segment.end, segment.start), rational(BigInt(units)))), sum);
    }, ZERO);
    return Object.freeze({
      resourceId: resource.id,
      allocatedUnitSeconds: allocated,
      availableUnitSeconds: available,
      utilization: compare(available, ZERO) === 0 ? null : divide(allocated, available),
    });
  }));
}

function selectRunningTasks(
  model: TemporalScheduleSourceModel,
  runtime: readonly RuntimeTask[],
  reached: ReadonlyMap<string, Rational>,
  capacities: ReadonlyMap<string, number>,
  current: Rational,
  asOf: Rational,
): readonly RuntimeTask[] | null {
  const usage = new Map<string, number>();
  const runnable = runtime.filter((task) => !task.completed &&
    (task.input.status === "active" || reached.has(task.input.source))).sort(taskOrder);
  const running: RuntimeTask[] = [];
  for (const task of runnable) {
    if (task.eligible === null) task.eligible = maximum(reached.get(task.input.source)!, asOf);
    const fits = canAllocate(model, task, capacities, usage, current);
    if (fits === null) return null;
    if (!fits) continue;
    allocate(task, usage);
    task.started = true;
    task.firstStart ??= current;
    running.push(task);
  }
  return Object.freeze(running);
}

function nextResourceEvent(
  running: readonly RuntimeTask[],
  boundaries: readonly Rational[],
  current: Rational,
): Rational | null {
  const boundary = nextBoundary(boundaries, current);
  const completion = running.reduce<Rational | null>((result, task) => {
    const value = add(current, task.remaining);
    return result === null ? value : minimum(result, value);
  }, null);
  return completion === null ? boundary : boundary === null
    ? completion
    : minimum(completion, boundary);
}

function advanceRunningTasks(
  running: readonly RuntimeTask[],
  current: Rational,
  next: Rational,
  satisfied: Map<string, Rational>,
): void {
  const elapsed = subtract(next, current);
  for (const task of running) {
    appendSegment(task.segments, current, next);
    task.remaining = subtract(task.remaining, elapsed);
    if (compare(task.remaining, ZERO) === 0) {
      task.completed = true;
      satisfied.set(task.input.id, next);
    }
  }
}

interface ResourceLoopResult {
  readonly current: Rational;
  readonly cause: CalendarScheduleCause | null;
}

interface ResourceLoopContext {
  readonly model: TemporalScheduleSourceModel;
  readonly input: CalendarSchedulerInput;
  readonly graph: GraphIndex;
  readonly capacities: ReadonlyMap<string, number>;
  readonly runtime: readonly RuntimeTask[];
  readonly reached: Map<string, Rational>;
  readonly satisfied: Map<string, Rational>;
  readonly boundaries: readonly Rational[];
}

function runResourceLoop(context: ResourceLoopContext): ResourceLoopResult {
  const { model, input, graph, capacities, runtime, reached, satisfied, boundaries } = context;
  let current = input.asOf;
  for (let events = 1; !reached.has(input.finishMilestoneId); events += 1) {
    if (events > TEMPORAL_SCHEDULE_SCHEDULER_LIMITS.scheduleEvents) {
      return { current, cause: cause("calendar_search_limit", [], [], events) };
    }
    const running = selectRunningTasks(model, runtime, reached, capacities, current, input.asOf);
    if (running === null) return { current, cause: cause("zone_range_exceeded") };
    const next = nextResourceEvent(running, boundaries, current);
    if (next === null || compare(next, current) <= 0 || compare(next, input.horizonEnd) > 0) {
      const pending = runtime.filter(({ completed }) => !completed);
      return {
        current,
        cause: cause(
          running.length === 0 ? "no_feasible_window" : "calendar_search_limit",
          pending.map(({ input: task }) => task.id),
          pending.flatMap(({ input: task }) => task.requirements.map(({ resourceId }) => resourceId)),
          running.length === 0 ? null : TEMPORAL_SCHEDULE_SCHEDULER_LIMITS.scheduleEvents,
        ),
      };
    }
    advanceRunningTasks(running, current, next, satisfied);
    current = next;
    propagateReached(graph, reached, satisfied);
  }
  return { current, cause: null };
}

function resourceSchedule(
  model: TemporalScheduleSourceModel,
  input: CalendarSchedulerInput,
  graph: GraphIndex,
  capacities: ReadonlyMap<string, number>,
): CalendarScheduleProfile {
  const runtime = graph.tasks.map((task): RuntimeTask => ({
    input: task,
    remaining: task.status === "done" ? ZERO :
      task.status === "active" ? task.remainingWorkSeconds ?? task.expectedWorkSeconds : task.expectedWorkSeconds,
    firstStart: task.status === "done" ? input.asOf : null,
    eligible: task.status === "active" || task.status === "done" ? input.asOf : null,
    started: task.status === "active" || task.status === "done",
    completed: task.status === "done",
    segments: [],
  }));
  const conflict = activeConflict(model, runtime, capacities, input.asOf);
  if (conflict !== null) return unavailableProfile(RESOURCE_IDENTITY, [conflict]);
  const reached = new Map(input.frontierMilestoneIds.map((id) => [id, input.asOf]));
  const satisfied = new Map<string, Rational>();
  for (const task of runtime.filter(({ input: edge }) => edge.status === "done")) {
    satisfied.set(task.input.id, input.asOf);
  }
  propagateReached(graph, reached, satisfied);
  const resourceIds = input.resources.map(({ id }) => id);
  const boundaries = taskChangeBoundaries(model, resourceIds, input.asOf, input.horizonEnd);
  if (boundaries === null) return unavailableProfile(RESOURCE_IDENTITY, [cause("zone_range_exceeded")]);
  const loop = runResourceLoop(
    { model, input, graph, capacities, runtime, reached, satisfied, boundaries },
  );
  if (loop.cause !== null) return unavailableProfile(RESOURCE_IDENTITY, [loop.cause]);
  const records = runtime.map((task) => scheduledTask(
    task.input,
    task.input.status === "active" ? task.input.remainingWorkSeconds ?? task.input.expectedWorkSeconds : task.input.expectedWorkSeconds,
    task.firstStart ?? input.asOf,
    task.completed ? satisfied.get(task.input.id) ?? input.asOf : loop.current,
    task.segments,
    task.eligible ?? input.asOf,
  )).sort((left, right) => compare(left.start, right.start) || compareStableStrings(left.id, right.id));
  const makespan = reached.get(input.finishMilestoneId)!;
  return Object.freeze({
    state: "available",
    algorithm: RESOURCE_IDENTITY,
    makespanSeconds: makespan,
    tasks: Object.freeze(records),
    milestones: Object.freeze(graph.order.flatMap((id): ScheduledMilestone[] => {
      const reach = reached.get(id);
      return reach === undefined ? [] : [Object.freeze({ id, reach })];
    })),
    utilization: utilization(model, input, capacities, records, makespan),
    unavailableCauses: Object.freeze([]),
  });
}

function validateInput(
  model: TemporalScheduleSourceModel,
  input: CalendarSchedulerInput,
  graph: GraphIndex,
  capacities: ReadonlyMap<string, number>,
): void {
  if (
    model.documentId !== input.documentId ||
    (model.profile.kind === "named_zone" &&
      (model.asOf === null || compare(model.asOf.instantSeconds, input.asOf) !== 0)) ||
    compare(input.asOf, input.horizonEnd) >= 0
  ) {
    throw new TypeError("scheduler input does not match the source or horizon");
  }
  for (const id of input.frontierMilestoneIds) {
    if (!input.milestoneIds.includes(id)) throw new TypeError(`unknown frontier milestone ${id}`);
  }
  for (const task of graph.tasks) {
    if (compare(task.expectedWorkSeconds, ZERO) <= 0 || compare(task.totalFloat, ZERO) < 0) {
      throw new TypeError(`invalid scheduler task work ${task.id}`);
    }
    if (task.remainingWorkSeconds !== undefined &&
      (task.status !== "active" || compare(task.remainingWorkSeconds, ZERO) <= 0 ||
       compare(task.remainingWorkSeconds, task.expectedWorkSeconds) > 0)) {
      throw new TypeError(`invalid remaining work ${task.id}`);
    }
    validateRequirements(task.requirements, capacities);
  }
}

export function analyzeCalendarSchedule(
  source: import("./source-types.js").TemporalScheduleSourceResult,
  input: CalendarSchedulerInput,
  capability: TemporalScheduleSchedulerCapability,
): CalendarSchedulerResult {
  const model = checkedModel(source, capability);
  const graph = graphIndex(input);
  const capacities = resourceMap(input.resources, input.capacityOverrides ?? new Map());
  validateInput(model, input, graph, capacities);
  const continuous = model.profile.kind === "continuous_fixed_offset";
  return Object.freeze({
    modelVersion: 1,
    documentId: model.documentId,
    source,
    precedence: continuous ? notApplicable(PRECEDENCE_IDENTITY) :
      precedenceSchedule(model, input, graph, capacities),
    resource: continuous ? notApplicable(RESOURCE_IDENTITY) :
      resourceSchedule(model, input, graph, capacities),
  });
}
