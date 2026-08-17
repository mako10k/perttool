import { evaluatePlanAssurance } from "../assurance/evaluate.js";
import { projectPlanAssuranceInput } from "../assurance/source.js";
import type { CanonicalCalendarValueV1, PlanAssuranceEvaluationV1, TaskPlanContractV1, TaskPlanContractV2 } from "../assurance/types.js";
import { milestoneAcceptanceBaseText } from "../milestone-acceptance/source.js";
import { TARGET_GRAMMAR_6_CAPABILITY } from "../parser/document-parser.js";
import { validateTargetGrammar6Document } from "../semantic/target-validator.js";
import { scanTemporalDeclarationBlocks, temporalScheduleBaseText } from "../temporal-schedule/source-lexical.js";
import { parseTemporalScheduleSource, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY } from "../temporal-schedule/source.js";
import type { EventBoundSource, TemporalInstantSource } from "../temporal-schedule/source-types.js";

function gcd(left: bigint, right: bigint): bigint {
  let a = left; let b = right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function calendar(value: TemporalInstantSource): CanonicalCalendarValueV1 {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)(Z|[+-]\d{2}:\d{2})$/u.exec(value.sourceText);
  if (match === null) throw new Error("validated Grammar 8 task bound is not canonical date-time source");
  const secondText = match[6]!;
  const [whole, fraction = ""] = secondText.split(".");
  const denominator = 10n ** BigInt(fraction.length);
  const rawNumerator = BigInt(whole!) * denominator + BigInt(fraction || "0");
  const divisor = gcd(rawNumerator, denominator);
  const numerator = rawNumerator / divisor;
  const reducedDenominator = denominator / divisor;
  const offset = match[7] === "Z" ? 0 : (match[7]!.startsWith("-") ? -1 : 1) *
    (Number(match[7]!.slice(1, 3)) * 60 + Number(match[7]!.slice(4, 6)));
  return Object.freeze({ kind: "date_time", year: Number(match[1]), month: Number(match[2]), day: Number(match[3]),
    hour: Number(match[4]), minute: Number(match[5]), second: Object.freeze({ numerator: numerator.toString(), denominator: reducedDenominator.toString() }),
    offsetMinutes: offset });
}

function bound(bounds: readonly EventBoundSource[], taskId: string, event: "start" | "finish", direction: "earliest" | "latest") {
  const value = bounds.find((item) => item.entityId === taskId && item.event === event && item.direction === direction);
  return value === undefined ? null : calendar(value.value);
}

function contractV2(contract: TaskPlanContractV1, bounds: readonly EventBoundSource[]): TaskPlanContractV2 {
  const { notBefore: _notBefore, ...retained } = contract;
  return Object.freeze({ ...retained, model: "Perttool.TaskPlanContract.v2", when: Object.freeze({
    startEarliest: bound(bounds, contract.taskId, "start", "earliest"),
    startLatest: bound(bounds, contract.taskId, "start", "latest"),
    finishEarliest: bound(bounds, contract.taskId, "finish", "earliest"),
    finishLatest: bound(bounds, contract.taskId, "finish", "latest"),
  }) });
}

export function evaluateContract9PlanAssurance(text: string): PlanAssuranceEvaluationV1 | null {
  const temporal = parseTemporalScheduleSource(text, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY);
  if (!temporal.ok || temporal.model === null || temporal.grammarVersion !== 8) return null;
  const grammar7 = temporalScheduleBaseText(text, scanTemporalDeclarationBlocks(text));
  const grammar6 = milestoneAcceptanceBaseText(grammar7);
  const checked = validateTargetGrammar6Document(grammar6, TARGET_GRAMMAR_6_CAPABILITY);
  if (!checked.ok || checked.validatedDocument === null) return null;
  const input = projectPlanAssuranceInput(checked.validatedDocument);
  const tasks = input.tasks.map((task) => Object.freeze({ ...task,
    contract: contractV2(task.contract as TaskPlanContractV1, temporal.model!.taskBounds) }));
  return evaluatePlanAssurance(Object.freeze({ ...input, tasks: Object.freeze(tasks) }));
}
