import { createUnifiedDiff } from "../editing/unified-diff.js";
import { sha256DigestUtf8 } from "../model/sha256.js";
import { applyTextEdits, type TextEdit } from "../mutation/text-edits.js";
import { scanTemporalDeclarationBlocks, temporalScheduleBaseText } from "../temporal-schedule/source-lexical.js";
import { parseTemporalScheduleSource, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY } from "../temporal-schedule/source.js";

export interface Contract9CandidateShape {
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

export interface Contract9CandidateOptions {
  readonly originalLabel?: string;
  readonly updatedLabel?: string;
}

type Contract9Identity<T> = T extends { readonly schemaVersion: "Perttool.MutationResult.v5" }
  ? Omit<T, "schemaVersion"> & { readonly schemaVersion: "Perttool.MutationResult.v6" }
  : T extends { readonly schemaVersion: "Perttool.UnitMigrationResult.v3" }
    ? Omit<T, "schemaVersion" | "unitMigration"> & {
        readonly schemaVersion: "Perttool.UnitMigrationResult.v4";
        readonly unitMigration: { readonly id: "perttool.unit-migration"; readonly version: 4 };
      }
    : T;

function identity<T extends Contract9CandidateShape>(value: T): Contract9Identity<T> {
  if (value.schemaVersion === "Perttool.MutationResult.v5") {
    return Object.freeze({ ...value, schemaVersion: "Perttool.MutationResult.v6" }) as Contract9Identity<T>;
  }
  if (value.schemaVersion === "Perttool.UnitMigrationResult.v3") {
    return Object.freeze({ ...value, schemaVersion: "Perttool.UnitMigrationResult.v4",
      unitMigration: Object.freeze({ id: "perttool.unit-migration", version: 4 }) }) as Contract9Identity<T>;
  }
  return value as Contract9Identity<T>;
}

export function liftContract9Candidate<T extends Contract9CandidateShape>(
  text: string,
  planner: (baseText: string) => T,
  options: Contract9CandidateOptions = {},
): Contract9Identity<T> {
  const source = parseTemporalScheduleSource(text, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY);
  if (source.grammarVersion !== 8 || !source.ok || source.model === null) return identity(planner(text));
  const base = temporalScheduleBaseText(text, scanTemporalDeclarationBlocks(text));
  const planned = planner(base);
  const originalDigest = sha256DigestUtf8(text);
  if (!planned.ok || planned.updatedText === null || planned.updatedDigest === null) {
    return identity(Object.freeze({ ...planned, originalDigest }));
  }
  const candidateText = applyTextEdits(text, planned.edits);
  const checked = parseTemporalScheduleSource(candidateText, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY);
  if (!checked.ok || checked.model === null) {
    return identity(Object.freeze({ ...planned, ok: false, changed: false, originalDigest,
      updatedDigest: null, updatedText: null, diff: null, edits: Object.freeze([]),
      diagnostics: Object.freeze([...planned.diagnostics, ...checked.diagnostics]),
      diagnosticsTruncated: planned.diagnosticsTruncated || checked.diagnosticsTruncated }));
  }
  return identity(Object.freeze({ ...planned, originalDigest, changed: candidateText !== text,
    updatedDigest: sha256DigestUtf8(candidateText), updatedText: candidateText,
    diff: createUnifiedDiff(text, candidateText, { originalLabel: options.originalLabel ?? "original",
      updatedLabel: options.updatedLabel ?? "candidate" }) }));
}
