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

function readSelection(
  model: PlanningPoolSourceModel,
  query: PlanningPoolReadQuery,
  diagnostics: PlanningPoolSourceDiagnostic[],
): Readonly<{
  works: PlanningPoolSourceModel["works"][number][];
  windows: PlanningPoolSourceModel["windows"][number][];
}> {
  if (query.operation === "work.list") {
    return { works: [...model.works], windows: [] };
  }
  if (query.operation === "window.list") {
    return { works: [], windows: [...model.windows] };
  }
  if (query.operation === "work.show") {
    const works = model.works.filter(({ qualifiedId }) =>
      qualifiedId === qualified(model.documentId, query.id ?? ""));
    if (works.length !== 1) {
      diagnostics.push(readDiagnostic(`Work ${query.id ?? ""} does not exist`));
    }
    return { works, windows: [] };
  }
  const windows = model.windows.filter(({ qualifiedId }) =>
    qualifiedId === qualified(model.documentId, query.id ?? ""));
  if (windows.length !== 1) {
    diagnostics.push(readDiagnostic(`Window ${query.id ?? ""} does not exist`));
  }
  return { works: [], windows };
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
    ? { works: [], windows: [] }
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
