import type { DeclarationNode, DocumentNode } from "../model/syntax.js";
import { EntityEditor } from "./entity-editor.js";
import { mutationDiagnostic, type MutationEditPlan } from "./diagnostics.js";
import type {
  ProjectClearableField,
  ProjectFieldSet,
  SetProjectMutation,
} from "./types.js";

const fieldOrder = [
  "version",
  "title",
  "description",
  "as_of",
  "duration_unit",
  "velocity",
  "finish",
  "critical_epsilon",
  "target_duration",
] as const;

const clearableFields = new Set<ProjectClearableField>([
  "description",
  "as_of",
  "velocity",
  "critical_epsilon",
  "target_duration",
]);

function requestError(value: unknown): string | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "project mutation requestがobjectではありません";
  }
  const request = value as Record<string, unknown>;
  if (request["kind"] !== "project.set") return "project mutation kindが未対応です";
  if (Object.keys(request).some((name) => !["kind", "set", "clear"].includes(name))) {
    return "project.set requestに未対応fieldが含まれています";
  }
  const rawSet = request["set"];
  const rawClear = request["clear"];
  if (
    rawSet !== undefined &&
    (rawSet === null || typeof rawSet !== "object" || Array.isArray(rawSet))
  ) {
    return "project setがobjectではありません";
  }
  if (rawClear !== undefined && !Array.isArray(rawClear)) return "clearがarrayではありません";

  const set = (rawSet ?? {}) as ProjectFieldSet;
  const clear = (rawClear ?? []) as readonly unknown[];
  const setEntries = Object.entries(set).filter(([, item]) => item !== undefined);
  if (setEntries.length === 0 && clear.length === 0) {
    return "project.setは少なくとも1つの変更指定を必要とします";
  }
  const setFields = new Set([
    "id",
    "version",
    "title",
    "description",
    "asOf",
    "durationUnit",
    "velocity",
    "finish",
    "criticalEpsilon",
    "targetDuration",
  ]);
  if (Object.keys(set).some((name) => !setFields.has(name))) {
    return "project setに未対応fieldが含まれています";
  }
  for (const name of [
    "id",
    "title",
    "description",
    "asOf",
    "velocity",
    "finish",
    "criticalEpsilon",
    "targetDuration",
  ] as const) {
    if (set[name] !== undefined && typeof set[name] !== "string") {
      return `${name}がstringではありません`;
    }
  }
  if (set.version !== undefined && !Number.isSafeInteger(set.version)) {
    return "versionがsafe integerではありません";
  }
  if (
    set.durationUnit !== undefined &&
    !new Set(["day", "hour", "point"]).has(set.durationUnit)
  ) {
    return "durationUnitがday/hour/pointではありません";
  }
  if (clear.some((name) => typeof name !== "string" || !clearableFields.has(name as ProjectClearableField))) {
    return "clearに未対応fieldが含まれています";
  }
  if (new Set(clear).size !== clear.length) return "clear fieldが重複しています";
  const conflicts: ReadonlyArray<readonly [keyof ProjectFieldSet, ProjectClearableField]> = [
    ["description", "description"],
    ["asOf", "as_of"],
    ["velocity", "velocity"],
    ["criticalEpsilon", "critical_epsilon"],
    ["targetDuration", "target_duration"],
  ];
  for (const [setName, clearName] of conflicts) {
    if (set[setName] !== undefined && clear.includes(clearName)) {
      return `${clearName}をsetとclearへ同時指定できません`;
    }
  }
  return undefined;
}

function planSet(
  text: string,
  declaration: DeclarationNode,
  mutation: SetProjectMutation,
): MutationEditPlan {
  const error = requestError(mutation);
  if (error !== undefined) {
    return { edits: [], diagnostic: mutationDiagnostic("PTMUT-301", error, declaration) };
  }
  const editor = new EntityEditor(text, declaration, fieldOrder, mutation.clear ?? []);
  const set = mutation.set ?? {};
  const edits = [];
  if (set.id !== undefined) {
    edits.push({
      startOffset: declaration.idSpan.start.offset,
      endOffset: declaration.idSpan.end.offset,
      replacement: set.id,
    });
  }
  if (set.version !== undefined) editor.setScalar("version", String(set.version));
  if (set.title !== undefined) editor.setScalar("title", JSON.stringify(set.title));
  if (set.description !== undefined) editor.setText("description", set.description);
  if (set.asOf !== undefined) editor.setScalar("as_of", set.asOf);
  if (set.durationUnit !== undefined) editor.setScalar("duration_unit", set.durationUnit);
  if (set.velocity !== undefined) editor.setScalar("velocity", set.velocity);
  if (set.finish !== undefined) editor.setScalar("finish", set.finish);
  if (set.criticalEpsilon !== undefined) {
    editor.setScalar("critical_epsilon", set.criticalEpsilon);
  }
  if (set.targetDuration !== undefined) {
    editor.setScalar("target_duration", set.targetDuration);
  }
  edits.push(...editor.finish());
  return { edits };
}

export function planProjectMutationEdits(
  text: string,
  document: DocumentNode,
  mutation: SetProjectMutation,
): MutationEditPlan {
  const declaration = document.declarations.find(({ kind }) => kind === "project");
  if (declaration === undefined) {
    return {
      edits: [],
      diagnostic: mutationDiagnostic("PTMUT-302", "project declarationが存在しません"),
    };
  }
  return planSet(text, declaration, mutation);
}
