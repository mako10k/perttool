import type { ActualWorkEvent } from "../actuals/source.js";
import { compare, divide, multiply, rational, rationalFromDuration, type Rational } from "../model/rational.js";
import { fieldNamed, type DeclarationNode, type DocumentNode, type ExactDurationValue, type TargetDeclarationKind } from "../model/syntax.js";

type Document = DocumentNode<TargetDeclarationKind>;
type Declaration = DeclarationNode<TargetDeclarationKind>;

function projectUnit(document: Document): unknown {
  const project = document.declarations.find(({ kind }) => kind === "project");
  return project === undefined ? null : fieldNamed(project, "duration_unit")?.value;
}

function taskDurations(task: Declaration): readonly ExactDurationValue[] {
  const estimate = fieldNamed(task, "estimate");
  const values = estimate === undefined
    ? [fieldNamed(task, "duration")?.value]
    : ["optimistic", "most_likely", "pessimistic"].map((name) =>
      estimate.children?.find((field) => field.name === name)?.value);
  return values as readonly ExactDurationValue[];
}

function unitSuffix(unit: unknown): string | null {
  return unit === "point" ? "p" : unit === "hour" ? "h" : unit === "day" ? "d" : null;
}

/** Prove a coordinated exact conversion; never consult observed/current velocity. */
export function provesHistoryUnitConversion(
  before: Document | null,
  after: Document | null,
  previousEvents: readonly ActualWorkEvent[],
  currentEvents: readonly ActualWorkEvent[],
  nonBaselineDigest: (event: ActualWorkEvent) => string,
): boolean {
  if (before === null || after === null) return false;
  const previousProject = before.declarations.find(({ kind }) => kind === "project");
  const currentProject = after.declarations.find(({ kind }) => kind === "project");
  if (previousProject?.id !== currentProject?.id) return false;
  const sourceUnit = projectUnit(before), targetUnit = projectUnit(after);
  const sourceSuffix = unitSuffix(sourceUnit), targetSuffix = unitSuffix(targetUnit);
  if (sourceSuffix === null || targetSuffix === null || sourceSuffix === targetSuffix) return false;
  let ratio: Rational | null = null;
  const converted = (oldValue: Rational, newValue: Rational): boolean => {
    if (oldValue.numerator === 0n) return newValue.numerator === 0n;
    const candidate = divide(newValue, oldValue);
    if (candidate.numerator <= 0n) return false;
    if (ratio === null) ratio = candidate;
    return compare(multiply(oldValue, ratio), newValue) === 0;
  };
  const currentById = new Map(currentEvents.map((event) => [event.id, event]));
  let baselines = 0;
  for (const oldEvent of previousEvents) {
    const newEvent = currentById.get(oldEvent.id);
    if (newEvent === undefined || nonBaselineDigest(oldEvent) !== nonBaselineDigest(newEvent)) return false;
    const a = oldEvent.plannedValue, b = newEvent.plannedValue;
    if (a === null || b === null) {
      if (a !== b) return false;
    } else {
      if (a.unit !== sourceUnit || b.unit !== targetUnit || !converted(a.value, b.value)) return false;
      baselines += 1;
    }
  }
  if (baselines === 0) return false;
  const currentTasks = new Map(after.declarations.filter(({ kind }) => kind === "task").map((task) => [task.id, task]));
  for (const oldTask of before.declarations.filter(({ kind }) => kind === "task")) {
    const newTask = currentTasks.get(oldTask.id);
    if (newTask === undefined || oldTask.from !== newTask.from || oldTask.to !== newTask.to ||
      fieldNamed(oldTask, "status")?.value !== fieldNamed(newTask, "status")?.value) return false;
    const oldDurations = taskDurations(oldTask), newDurations = taskDurations(newTask);
    if (oldDurations.length !== newDurations.length) return false;
    for (let index = 0; index < oldDurations.length; index += 1) {
      const a = oldDurations[index]!, b = newDurations[index]!;
      if (a.suffix !== sourceSuffix || b.suffix !== targetSuffix ||
        !converted(rationalFromDuration(a), rationalFromDuration(b))) return false;
    }
  }
  if (ratio === null) return false;
  if (sourceUnit === "day" && targetUnit === "hour") return compare(ratio, rational(24n)) === 0;
  if (sourceUnit === "hour" && targetUnit === "day") return compare(ratio, rational(1n, 24n)) === 0;
  return true;
}
