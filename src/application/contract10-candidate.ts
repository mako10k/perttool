import { sha256DigestUtf8 } from "../model/sha256.js";
import { applyTextEdits, type TextEdit } from "../mutation/text-edits.js";
import {
  planningPoolBaseText,
  scanPlanningDeclarationBlocks,
} from "../planning-pool/source-lexical.js";
import {
  parsePlanningPoolSource,
  PLANNING_POOL_SOURCE_CAPABILITY,
} from "../planning-pool/source.js";
import {
  finalizeLiftedCandidate,
} from "./contract9-candidate.js";

export interface Contract10CandidateShape {
  readonly schemaVersion: string | undefined;
  readonly ok: boolean;
  readonly changed: boolean;
  readonly originalDigest: string;
  readonly updatedDigest: string | null;
  readonly updatedText: string | null;
  readonly diff: string | null;
  readonly edits: readonly TextEdit[];
  readonly diagnostics: readonly unknown[];
  readonly diagnosticsTruncated: boolean;
}

export interface Contract10CandidateOptions {
  readonly originalLabel?: string;
  readonly updatedLabel?: string;
}

type Contract10Identity<T> =
  T extends { readonly schemaVersion: "Perttool.AdvanceResult.v3" }
    ? Omit<T, "schemaVersion"> & { readonly schemaVersion: "Perttool.AdvanceResult.v4" }
    : T extends { readonly schemaVersion: "Perttool.UnitMigrationResult.v4" }
      ? Omit<T, "schemaVersion" | "unitMigration"> & {
          readonly schemaVersion: "Perttool.UnitMigrationResult.v5";
          readonly unitMigration: {
            readonly id: "perttool.unit-migration";
            readonly version: 5;
          };
        }
      : T;

function identity<T extends Contract10CandidateShape>(value: T): Contract10Identity<T> {
  if (value.schemaVersion === "Perttool.AdvanceResult.v3") {
    return Object.freeze({
      ...value,
      schemaVersion: "Perttool.AdvanceResult.v4",
    }) as Contract10Identity<T>;
  }
  if (value.schemaVersion === "Perttool.UnitMigrationResult.v4") {
    return Object.freeze({
      ...value,
      schemaVersion: "Perttool.UnitMigrationResult.v5",
      unitMigration: Object.freeze({ id: "perttool.unit-migration", version: 5 }),
    }) as Contract10Identity<T>;
  }
  return value as Contract10Identity<T>;
}

export function liftContract10Candidate<T extends Contract10CandidateShape>(
  text: string,
  planner: (baseText: string) => T,
  options: Contract10CandidateOptions = {},
): Contract10Identity<T> {
  const source = parsePlanningPoolSource(text, PLANNING_POOL_SOURCE_CAPABILITY);
  if (source.grammarVersion !== 9 || !source.ok || source.model === null) {
    return identity(planner(text));
  }
  const base = planningPoolBaseText(text, scanPlanningDeclarationBlocks(text));
  const planned = planner(base);
  const originalDigest = sha256DigestUtf8(text);
  if (!planned.ok || planned.updatedText === null || planned.updatedDigest === null) {
    return identity(Object.freeze({ ...planned, originalDigest }));
  }
  const candidateText = applyTextEdits(text, planned.edits);
  const checked = parsePlanningPoolSource(
    candidateText,
    PLANNING_POOL_SOURCE_CAPABILITY,
  );
  return identity(finalizeLiftedCandidate(
    planned, text, candidateText, originalDigest, options, checked,
  ));
}
