import type { DeclarationNode, DocumentNode } from "../model/syntax.js";
import {
  canonicalizeExactDurationSourceToken,
} from "../model/exact-duration-source.js";
import { EntityEditor } from "./entity-editor.js";
import { mutationDiagnostic, type MutationEditPlan } from "./diagnostics.js";
import type {
  TargetGovernanceProjectClearableField,
  TargetGovernanceProjectFieldSet,
  TargetGovernanceSetProjectMutation,
} from "./target-types.js";
import type {
  ProjectClearableField,
  ProjectFieldSet,
  SetProjectMutation,
} from "./types.js";

const activeFieldOrder = [
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

const activeClearableFields = new Set<ProjectClearableField>([
  "description",
  "as_of",
  "velocity",
  "critical_epsilon",
  "target_duration",
]);

export interface ProjectMutationProfile {
  readonly exactDurations: boolean;
  readonly governanceSource: boolean;
  readonly governanceGrammarVersion: 4 | 5;
  readonly fieldOrder: readonly string[];
}

export const ACTIVE_PROJECT_MUTATION_PROFILE: ProjectMutationProfile =
  Object.freeze({
    exactDurations: false,
    governanceSource: false,
    governanceGrammarVersion: 4,
    fieldOrder: activeFieldOrder,
  });

export const TARGET_GRAMMAR_2_PROJECT_MUTATION_PROFILE: ProjectMutationProfile =
  ACTIVE_PROJECT_MUTATION_PROFILE;

export const TARGET_GRAMMAR_3_PROJECT_MUTATION_PROFILE: ProjectMutationProfile =
  Object.freeze({
    exactDurations: true,
    governanceSource: false,
    governanceGrammarVersion: 4,
    fieldOrder: activeFieldOrder,
  });

export const TARGET_GRAMMAR_4_PROJECT_MUTATION_PROFILE: ProjectMutationProfile =
  Object.freeze({
    exactDurations: true,
    governanceSource: true,
    governanceGrammarVersion: 4,
    fieldOrder: [
      "version",
      "title",
      "description",
      "as_of",
      "duration_unit",
      "velocity",
      "finish",
      "goal_owner",
      "goal_delegates",
      "dag_owner",
      "dag_delegates",
      "critical_epsilon",
      "target_duration",
    ],
  });

export const TARGET_GRAMMAR_5_PROJECT_MUTATION_PROFILE:
  ProjectMutationProfile = Object.freeze({
    ...TARGET_GRAMMAR_4_PROJECT_MUTATION_PROFILE,
    governanceGrammarVersion: 5,
  });

function canonicalDuration(
  value: string,
  profile: ProjectMutationProfile,
): string {
  if (!profile.exactDurations) return value;
  return canonicalizeExactDurationSourceToken(value)?.token ?? value;
}

function requestError(
  value: unknown,
  profile: ProjectMutationProfile,
): string | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "project mutation request is not an object";
  }
  const request = value as Record<string, unknown>;
  if (request["kind"] !== "project.set") return "project mutation kind is unsupported";
  if (Object.keys(request).some((name) => !["kind", "set", "clear"].includes(name))) {
    return "project.set request contains unsupported fields";
  }
  const rawSet = request["set"];
  const rawClear = request["clear"];
  if (
    rawSet !== undefined &&
    (rawSet === null || typeof rawSet !== "object" || Array.isArray(rawSet))
  ) {
    return "project set is not an object";
  }
  if (rawClear !== undefined && !Array.isArray(rawClear)) return "clear is not an array";

  const set = (rawSet ?? {}) as TargetGovernanceProjectFieldSet;
  const clear = (rawClear ?? []) as readonly unknown[];
  const setEntries = Object.entries(set).filter(([, item]) => item !== undefined);
  if (setEntries.length === 0 && clear.length === 0) {
    return "project.set requires at least one change specification";
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
    ...(profile.governanceSource
      ? ["goalOwner", "goalDelegates", "dagOwner", "dagDelegates"]
      : []),
  ]);
  if (Object.keys(set).some((name) => !setFields.has(name))) {
    return "project set contains unsupported fields";
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
    ...(profile.governanceSource ? ["goalOwner", "dagOwner"] as const : []),
  ] as const) {
    if (set[name] !== undefined && typeof set[name] !== "string") {
      return `${name} is not a string`;
    }
  }
  if (profile.governanceSource) {
    for (const name of ["goalDelegates", "dagDelegates"] as const) {
      const value = set[name];
      if (
        value !== undefined &&
        (
          !Array.isArray(value) ||
          value.some(
            (principal) =>
              typeof principal !== "string" ||
              !/^[A-Za-z][A-Za-z0-9_-]*$/.test(principal),
          )
        )
      ) {
        return `${name} is not a principal list`;
      }
    }
    for (const name of ["goalOwner", "dagOwner"] as const) {
      const value = set[name];
      if (
        value !== undefined &&
        !/^[A-Za-z][A-Za-z0-9_-]*$/.test(value)
      ) {
        return `${name} is not a principal`;
      }
    }
    const governanceSet = [
      set.goalOwner,
      set.goalDelegates,
      set.dagOwner,
      set.dagDelegates,
    ].some((item) => item !== undefined);
    if (
      governanceSet &&
      set.version !== undefined &&
      set.version !== profile.governanceGrammarVersion
    ) {
      return `setting governance fields requires version ${profile.governanceGrammarVersion}`;
    }
  }
  if (set.version !== undefined && !Number.isSafeInteger(set.version)) {
    return "version is not a safe integer";
  }
  if (
    set.durationUnit !== undefined &&
    !new Set(["day", "hour", "point"]).has(set.durationUnit)
  ) {
    return "durationUnit must be day, hour, or point";
  }
  const clearableFields = new Set<string>([
    ...activeClearableFields,
    ...(profile.governanceSource
      ? ["goal_owner", "goal_delegates", "dag_owner", "dag_delegates"]
      : []),
  ]);
  if (clear.some((name) => typeof name !== "string" || !clearableFields.has(name))) {
    return "clear contains unsupported fields";
  }
  if (new Set(clear).size !== clear.length) return "clear contains duplicate fields";
  const conflicts: ReadonlyArray<
    readonly [
      keyof TargetGovernanceProjectFieldSet,
      TargetGovernanceProjectClearableField,
    ]
  > = [
    ["description", "description"],
    ["asOf", "as_of"],
    ["velocity", "velocity"],
    ["criticalEpsilon", "critical_epsilon"],
    ["targetDuration", "target_duration"],
    ...(profile.governanceSource
      ? [
          ["goalOwner", "goal_owner"],
          ["goalDelegates", "goal_delegates"],
          ["dagOwner", "dag_owner"],
          ["dagDelegates", "dag_delegates"],
        ] as const
      : []),
  ];
  for (const [setName, clearName] of conflicts) {
    if (set[setName] !== undefined && clear.includes(clearName)) {
      return `${clearName} cannot be specified in both set and clear`;
    }
  }
  return undefined;
}

function planSet(
  text: string,
  declaration: DeclarationNode,
  mutation: SetProjectMutation | TargetGovernanceSetProjectMutation,
  profile: ProjectMutationProfile,
): MutationEditPlan {
  const error = requestError(mutation, profile);
  if (error !== undefined) {
    return { edits: [], diagnostic: mutationDiagnostic("PTMUT-301", error, declaration) };
  }
  const editor = new EntityEditor(
    text,
    declaration,
    profile.fieldOrder,
    mutation.clear ?? [],
  );
  const set = mutation.set ?? {};
  const edits = [];
  if (set.id !== undefined) {
    edits.push({
      startOffset: declaration.idSpan.start.offset,
      endOffset: declaration.idSpan.end.offset,
      replacement: set.id,
    });
  }
  const governanceSet =
    profile.governanceSource &&
    (
      (set as TargetGovernanceProjectFieldSet).goalOwner !== undefined ||
      (set as TargetGovernanceProjectFieldSet).goalDelegates !== undefined ||
      (set as TargetGovernanceProjectFieldSet).dagOwner !== undefined ||
      (set as TargetGovernanceProjectFieldSet).dagDelegates !== undefined
    );
  if (set.version !== undefined) {
    editor.setScalar("version", String(set.version));
  } else if (
    governanceSet &&
    editor.fieldValue("version") !== profile.governanceGrammarVersion
  ) {
    editor.setScalar("version", String(profile.governanceGrammarVersion));
  }
  if (set.title !== undefined) editor.setScalar("title", JSON.stringify(set.title));
  if (set.description !== undefined) editor.setText("description", set.description);
  if (set.asOf !== undefined) editor.setScalar("as_of", set.asOf);
  if (set.durationUnit !== undefined) editor.setScalar("duration_unit", set.durationUnit);
  if (set.velocity !== undefined) editor.setScalar("velocity", set.velocity);
  if (set.finish !== undefined) editor.setScalar("finish", set.finish);
  if (profile.governanceSource) {
    const governanceSet = set as TargetGovernanceProjectFieldSet;
    if (governanceSet.goalOwner !== undefined) {
      editor.setScalar("goal_owner", governanceSet.goalOwner);
    }
    if (governanceSet.goalDelegates !== undefined) {
      editor.setScalar(
        "goal_delegates",
        `[${governanceSet.goalDelegates.join(", ")}]`,
      );
    }
    if (governanceSet.dagOwner !== undefined) {
      editor.setScalar("dag_owner", governanceSet.dagOwner);
    }
    if (governanceSet.dagDelegates !== undefined) {
      editor.setScalar(
        "dag_delegates",
        `[${governanceSet.dagDelegates.join(", ")}]`,
      );
    }
  }
  if (set.criticalEpsilon !== undefined) {
    editor.setScalar(
      "critical_epsilon",
      canonicalDuration(set.criticalEpsilon, profile),
    );
  }
  if (set.targetDuration !== undefined) {
    editor.setScalar(
      "target_duration",
      canonicalDuration(set.targetDuration, profile),
    );
  }
  edits.push(...editor.finish());
  return { edits };
}

export function planProjectMutationEdits(
  text: string,
  document: DocumentNode,
  mutation: SetProjectMutation | TargetGovernanceSetProjectMutation,
  profile: ProjectMutationProfile = ACTIVE_PROJECT_MUTATION_PROFILE,
): MutationEditPlan {
  const declaration = document.declarations.find(({ kind }) => kind === "project");
  if (declaration === undefined) {
    return {
      edits: [],
      diagnostic: mutationDiagnostic("PTMUT-302", "project declaration does not exist"),
    };
  }
  return planSet(text, declaration, mutation, profile);
}
