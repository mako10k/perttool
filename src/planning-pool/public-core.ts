import { sha256DigestUtf8 } from "../model/sha256.js";
import {
  observePlanningPool,
  PLANNING_OBSERVATION_CORE_CAPABILITY,
} from "./observation.js";
import type {
  PlanningObservationExecutionContext,
  PlanningPoolObservationResult,
} from "./observation-types.js";
import {
  preflightPlanningReshape,
  preparePlanningReshapeApply,
  PLANNING_RESHAPE_CORE_CAPABILITY,
} from "./reshape.js";
import { PlanningReshapeTokenRegistry } from "./reshape-token.js";
import type {
  PlanningReshapeApplyPreparationResult,
  PlanningReshapePreflightResult,
} from "./reshape-types.js";
import {
  parsePlanningPoolSource,
  PLANNING_POOL_SOURCE_CAPABILITY,
} from "./source.js";
import type {
  PlanningPoolSourceDiagnostic,
  PlanningPoolSourceModel,
} from "./source-types.js";
import {
  auditPlanningWindowMutation,
  PLANNING_WINDOW_CORE_CAPABILITY,
} from "./window.js";
import type { PlanningWindowMutationAuditResult } from "./window-types.js";

export type PlanningPoolReadOperation =
  | "work.list"
  | "work.show"
  | "event.list"
  | "event.show"
  | "activity.list"
  | "activity.show"
  | "window.list"
  | "window.show";

export interface PlanningPoolReadQuery {
  readonly operation: PlanningPoolReadOperation;
  readonly id?: string;
}

export interface PlanningPoolReadResult {
  readonly schemaVersion: "Perttool.PlanningPoolResult.v1";
  readonly operation: PlanningPoolReadOperation;
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly sourceDigest: string;
  readonly query: { readonly id: string | null };
  readonly workOrder: readonly string[];
  readonly works: readonly PlanningPoolSourceModel["works"][number][];
  readonly events: readonly PlanningPoolSourceModel["events"][number][];
  readonly activities: readonly PlanningPoolSourceModel["activities"][number][];
  readonly windows: readonly PlanningPoolSourceModel["windows"][number][];
  readonly diagnostics: readonly PlanningPoolSourceDiagnostic[];
}

function qualified(documentId: string, id: string): string {
  return id.includes("::") ? id : `${documentId}::${id}`;
}

function readDiagnostic(message: string): PlanningPoolSourceDiagnostic {
  return Object.freeze({
    code: "PTPOOL-102",
    severity: "error" as const,
    message,
    data: Object.freeze({}),
  });
}

type PlanningPoolReadSelection = {
  works: PlanningPoolSourceModel["works"][number][];
  events: PlanningPoolSourceModel["events"][number][];
  activities: PlanningPoolSourceModel["activities"][number][];
  windows: PlanningPoolSourceModel["windows"][number][];
};

type PlanningPoolReadHandler = (
  model: PlanningPoolSourceModel,
  query: PlanningPoolReadQuery,
  diagnostics: PlanningPoolSourceDiagnostic[],
) => PlanningPoolReadSelection;

function emptyReadSelection(
  selected: Partial<PlanningPoolReadSelection> = {},
): PlanningPoolReadSelection {
  return {
    works: [],
    events: [],
    activities: [],
    windows: [],
    ...selected,
  };
}

function selectWorkShow(
  model: PlanningPoolSourceModel,
  query: PlanningPoolReadQuery,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningPoolReadSelection {
  const works = model.works.filter(({ qualifiedId }) =>
    qualifiedId === qualified(model.documentId, query.id ?? ""));
  if (works.length !== 1) {
    diagnostics.push(readDiagnostic(`Work ${query.id ?? ""} does not exist`));
  }
  const workId = works[0]?.qualifiedId;
  const windows = workId === undefined
    ? []
    : model.windows.filter((window) =>
        window.works.some(({ qualifiedId }) => qualifiedId === workId)
      );
  return emptyReadSelection({ works, windows });
}

function selectEventShow(
  model: PlanningPoolSourceModel,
  query: PlanningPoolReadQuery,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningPoolReadSelection {
  const events = model.events.filter(({ qualifiedId }) =>
    qualifiedId === qualified(model.documentId, query.id ?? ""));
  if (events.length !== 1) {
    diagnostics.push(readDiagnostic(`Event ${query.id ?? ""} does not exist`));
  }
  const eventId = events[0]?.qualifiedId;
  const works = eventId === undefined
    ? []
    : model.works.filter((work) =>
        work.events.some(({ qualifiedId }) => qualifiedId === eventId)
      );
  return emptyReadSelection({ works, events });
}

function selectActivityShow(
  model: PlanningPoolSourceModel,
  query: PlanningPoolReadQuery,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningPoolReadSelection {
  const activities = model.activities.filter(({ qualifiedId }) =>
    qualifiedId === qualified(model.documentId, query.id ?? ""));
  if (activities.length !== 1) {
    diagnostics.push(readDiagnostic(`Activity ${query.id ?? ""} does not exist`));
  }
  const activityId = activities[0]?.qualifiedId;
  const works = activityId === undefined
    ? []
    : model.works.filter((work) =>
        work.activities.some(({ qualifiedId }) => qualifiedId === activityId)
      );
  return emptyReadSelection({ works, activities });
}

function selectWindowShow(
  model: PlanningPoolSourceModel,
  query: PlanningPoolReadQuery,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningPoolReadSelection {
  const windows = model.windows.filter(({ qualifiedId }) =>
    qualifiedId === qualified(model.documentId, query.id ?? ""));
  if (windows.length !== 1) {
    diagnostics.push(readDiagnostic(`Window ${query.id ?? ""} does not exist`));
  }
  return emptyReadSelection({ windows });
}

const READ_SELECTION_HANDLERS: Readonly<
  Record<PlanningPoolReadOperation, PlanningPoolReadHandler>
> = Object.freeze({
  "work.list": (model) => emptyReadSelection({ works: [...model.works] }),
  "work.show": selectWorkShow,
  "event.list": (model) => emptyReadSelection({ events: [...model.events] }),
  "event.show": selectEventShow,
  "activity.list": (model) => emptyReadSelection({ activities: [...model.activities] }),
  "activity.show": selectActivityShow,
  "window.list": (model) => emptyReadSelection({ windows: [...model.windows] }),
  "window.show": selectWindowShow,
});

function readSelection(
  model: PlanningPoolSourceModel,
  query: PlanningPoolReadQuery,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningPoolReadSelection {
  return READ_SELECTION_HANDLERS[query.operation](model, query, diagnostics);
}

export function inspectPlanningPool(
  text: string,
  query: PlanningPoolReadQuery,
): PlanningPoolReadResult {
  const sourceDigest = sha256DigestUtf8(text);
  const parsed = parsePlanningPoolSource(text, PLANNING_POOL_SOURCE_CAPABILITY);
  const diagnostics: PlanningPoolSourceDiagnostic[] = [...parsed.diagnostics];
  if (!parsed.ok || parsed.model === null) {
    diagnostics.push(Object.freeze({
      code: "PTPOOL-116",
      severity: "error",
      message: "Planning Pool read requires a valid Grammar 9 source",
      data: Object.freeze({}),
    }));
  }
  const selection = parsed.model === null
    ? { works: [], events: [], activities: [], windows: [] }
    : readSelection(parsed.model, query, diagnostics);
  return Object.freeze({
    schemaVersion: "Perttool.PlanningPoolResult.v1",
    operation: query.operation,
    ok: !diagnostics.some(({ severity }) => severity === "error"),
    documentId: parsed.documentId,
    sourceDigest,
    query: Object.freeze({ id: query.id ?? null }),
    workOrder: Object.freeze(parsed.model?.workOrder.map(({ qualifiedId }) => qualifiedId) ?? []),
    works: Object.freeze(selection.works),
    events: Object.freeze(selection.events),
    activities: Object.freeze(selection.activities),
    windows: Object.freeze(selection.windows),
    diagnostics: Object.freeze(diagnostics),
  });
}

export function observePlanningPoolSnapshot(
  text: string,
  input: unknown,
  execution: PlanningObservationExecutionContext,
): PlanningPoolObservationResult {
  return observePlanningPool(
    text,
    input,
    execution,
    PLANNING_OBSERVATION_CORE_CAPABILITY,
  );
}

export function preflightPlanningPoolReshape(
  text: string,
  input: unknown,
  registry: PlanningReshapeTokenRegistry,
): PlanningReshapePreflightResult {
  return preflightPlanningReshape(
    text,
    input,
    registry,
    PLANNING_RESHAPE_CORE_CAPABILITY,
  );
}

export function preparePlanningPoolReshapeCoreApply(
  text: string,
  input: unknown,
  preflightHash: string,
  preflightToken: string,
  registry: PlanningReshapeTokenRegistry,
): PlanningReshapeApplyPreparationResult {
  return preparePlanningReshapeApply(
    text,
    input,
    preflightHash,
    preflightToken,
    registry,
    PLANNING_RESHAPE_CORE_CAPABILITY,
  );
}

export function auditPlanningWindowMutationCore(
  text: string,
  input: unknown,
): PlanningWindowMutationAuditResult {
  return auditPlanningWindowMutation(text, input, PLANNING_WINDOW_CORE_CAPABILITY);
}
