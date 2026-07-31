import {
  compareStableStrings,
} from "../model/diagnostics.js";
import type {
  DeclarationNode,
  DocumentNode,
  TargetDeclarationKind,
} from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import {
  advanceOwnedTerminalSeparatorStart,
  planAdvanceDeclarationDeletions,
} from "../mutation/advance-deletion.js";
import {
  deleteDeclarationEdit,
  splitPhysicalLines,
} from "../mutation/source.js";

export const ADVANCE_HISTORY_SAFETY_MODEL_VERSION = 1 as const;

export type AdvanceDestructiveEntityKind =
  | "task"
  | "gate"
  | "milestone"
  | "work_event";

export interface AdvanceDestructiveRecordV1 {
  readonly entityKind: AdvanceDestructiveEntityKind;
  readonly entityId: string;
  readonly field: "declaration" | "state";
  readonly startOffset: number;
  readonly endOffset: number;
}

export interface AdvanceDestructiveSelection {
  readonly removedTaskIds: readonly string[];
  readonly removedGateIds: readonly string[];
  readonly removedMilestoneIds: readonly string[];
  readonly removedWorkEventIds: readonly string[];
  readonly stateChangedMilestoneIds: readonly string[];
}

export interface RawByteEditV1 {
  readonly startOffset: number;
  readonly endOffset: number;
  readonly insertedBytes: number;
}

export interface AdvanceHistoryAssessmentInput {
  readonly currentText: string;
  readonly currentDocument: DocumentNode<TargetDeclarationKind>;
  readonly currentSource: Uint8Array;
  readonly headText: string;
  readonly headDocument: DocumentNode<TargetDeclarationKind>;
  readonly headSource: Uint8Array;
  readonly indexSource: Uint8Array;
  readonly destructiveRecords: readonly AdvanceDestructiveRecordV1[];
}

export type AdvanceHistoryAssessmentCause =
  | "baseline_matches"
  | "destructive_overlap"
  | "baseline_invalid"
  | "correspondence_missing"
  | "correspondence_ambiguous";

export interface AdvanceHistoryAssessment {
  readonly modelVersion: typeof ADVANCE_HISTORY_SAFETY_MODEL_VERSION;
  readonly status: "passed" | "blocked";
  readonly cause: AdvanceHistoryAssessmentCause;
  readonly destructiveEntityIds: readonly string[];
  readonly overlappingEntityIds: readonly string[];
}

type ByteOperation = "equal" | "delete" | "insert";

interface Utf16Range {
  readonly startOffset: number;
  readonly endOffset: number;
}

interface ByteRange {
  readonly startOffset: number;
  readonly endOffset: number;
}

function selected(
  declaration: DeclarationNode<TargetDeclarationKind>,
  selection: AdvanceDestructiveSelection,
): boolean {
  switch (declaration.kind) {
    case "task":
      return selection.removedTaskIds.includes(declaration.id);
    case "gate":
      return selection.removedGateIds.includes(declaration.id);
    case "milestone":
      return selection.removedMilestoneIds.includes(declaration.id);
    case "work_event":
      return selection.removedWorkEventIds.includes(declaration.id);
    default:
      return false;
  }
}

function recordOrder(
  left: AdvanceDestructiveRecordV1,
  right: AdvanceDestructiveRecordV1,
): number {
  return (
    left.startOffset - right.startOffset ||
    left.endOffset - right.endOffset ||
    compareStableStrings(left.entityKind, right.entityKind) ||
    compareStableStrings(left.entityId, right.entityId) ||
    compareStableStrings(left.field, right.field)
  );
}

export function deriveAdvanceDestructiveRecords(
  text: string,
  document: DocumentNode<TargetDeclarationKind>,
  selection: AdvanceDestructiveSelection,
): readonly AdvanceDestructiveRecordV1[] {
  if (document.text !== text) {
    throw new Error("advance destructive record source does not match document");
  }
  const declarationDeletions = new Map(
    planAdvanceDeclarationDeletions(
      text,
      document,
      (declaration) => selected(declaration, selection),
    ).map(({ declaration, edit }) => [declaration, edit] as const),
  );
  const records: AdvanceDestructiveRecordV1[] = [];
  for (const declaration of document.declarations) {
    if (selected(declaration, selection)) {
      const edit = declarationDeletions.get(declaration);
      if (edit === undefined) {
        throw new Error("advance destructive selection has no deletion edit");
      }
      records.push({
        entityKind: declaration.kind as AdvanceDestructiveEntityKind,
        entityId: declaration.id,
        field: "declaration",
        startOffset: edit.startOffset,
        endOffset: edit.endOffset,
      });
    }
    if (
      declaration.kind === "milestone" &&
      selection.stateChangedMilestoneIds.includes(declaration.id)
    ) {
      const state = fieldNamed(declaration, "state");
      if (state !== undefined) {
        records.push({
          entityKind: "milestone",
          entityId: declaration.id,
          field: "state",
          startOffset: state.valueSpan.start.offset,
          endOffset: state.valueSpan.end.offset,
        });
      }
    }
  }

  const replacedStateIds = selection.stateChangedMilestoneIds.flatMap(
    (id) => {
      const matches = document.declarations.filter(
        ({ kind, id: candidateId }) =>
          kind === "milestone" && candidateId === id,
      );
      if (matches.length !== 1) {
        throw new Error(
          `advance state selection has no unique milestone ${id}`,
        );
      }
      return fieldNamed(matches[0]!, "state") === undefined ? [] : [id];
    },
  );
  const expected = [
    ...selection.removedTaskIds.map((id) => `task:${id}:declaration`),
    ...selection.removedGateIds.map((id) => `gate:${id}:declaration`),
    ...selection.removedMilestoneIds.map(
      (id) => `milestone:${id}:declaration`,
    ),
    ...selection.removedWorkEventIds.map(
      (id) => `work_event:${id}:declaration`,
    ),
    ...replacedStateIds.map(
      (id) => `milestone:${id}:state`,
    ),
  ].sort(compareStableStrings);
  const actual = records
    .map(({ entityKind, entityId, field }) =>
      `${entityKind}:${entityId}:${field}`
    )
    .sort(compareStableStrings);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("advance destructive selection has missing or duplicate entities");
  }
  return Object.freeze(records.sort(recordOrder));
}

function myersOperations(
  before: Uint8Array,
  after: Uint8Array,
): readonly ByteOperation[] {
  const maximum = before.length + after.length;
  let frontier = new Map<number, number>([[1, 0]]);
  const trace: Array<ReadonlyMap<number, number>> = [];

  for (let distance = 0; distance <= maximum; distance += 1) {
    const next = new Map<number, number>();
    for (
      let diagonal = -distance;
      diagonal <= distance;
      diagonal += 2
    ) {
      const deletion = frontier.get(diagonal - 1);
      const insertion = frontier.get(diagonal + 1);
      let x: number;
      if (
        diagonal === -distance ||
        (
          diagonal !== distance &&
          (deletion ?? Number.NEGATIVE_INFINITY) <
            (insertion ?? Number.NEGATIVE_INFINITY)
        )
      ) {
        x = insertion ?? 0;
      } else {
        x = (deletion ?? -1) + 1;
      }
      let y = x - diagonal;
      while (
        x < before.length &&
        y < after.length &&
        before[x] === after[y]
      ) {
        x += 1;
        y += 1;
      }
      next.set(diagonal, x);
      if (x >= before.length && y >= after.length) {
        trace.push(next);
        const reversed: ByteOperation[] = [];
        let currentX = before.length;
        let currentY = after.length;
        for (
          let step = distance;
          step > 0;
          step -= 1
        ) {
          const previous = trace[step - 1]!;
          const currentDiagonal = currentX - currentY;
          const previousDeletion = previous.get(currentDiagonal - 1);
          const previousInsertion = previous.get(currentDiagonal + 1);
          const previousDiagonal =
            currentDiagonal === -step ||
            (
              currentDiagonal !== step &&
              (previousDeletion ?? Number.NEGATIVE_INFINITY) <
                (previousInsertion ?? Number.NEGATIVE_INFINITY)
            )
              ? currentDiagonal + 1
              : currentDiagonal - 1;
          const previousX = previous.get(previousDiagonal);
          if (previousX === undefined) {
            throw new Error("raw-byte Myers trace is incomplete");
          }
          const previousY = previousX - previousDiagonal;
          while (currentX > previousX && currentY > previousY) {
            reversed.push("equal");
            currentX -= 1;
            currentY -= 1;
          }
          if (currentX === previousX) {
            reversed.push("insert");
            currentY -= 1;
          } else {
            reversed.push("delete");
            currentX -= 1;
          }
        }
        while (currentX > 0 && currentY > 0) {
          reversed.push("equal");
          currentX -= 1;
          currentY -= 1;
        }
        return Object.freeze(reversed.reverse());
      }
    }
    trace.push(next);
    frontier = next;
  }
  throw new Error("raw-byte Myers diff did not terminate");
}

export function rawByteEditsV1(
  before: Uint8Array,
  after: Uint8Array,
): readonly RawByteEditV1[] {
  let prefix = 0;
  while (
    prefix < before.length &&
    prefix < after.length &&
    before[prefix] === after[prefix]
  ) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - suffix - 1] ===
      after[after.length - suffix - 1]
  ) {
    suffix += 1;
  }
  const beforeMiddle = before.subarray(prefix, before.length - suffix);
  const afterMiddle = after.subarray(prefix, after.length - suffix);
  if (beforeMiddle.length === 0 && afterMiddle.length === 0) return [];

  const operations = myersOperations(beforeMiddle, afterMiddle);
  const edits: RawByteEditV1[] = [];
  let oldOffset = prefix;
  let editStart: number | null = null;
  let editEnd = prefix;
  let insertedBytes = 0;
  const flush = (): void => {
    if (editStart === null) return;
    edits.push({
      startOffset: editStart,
      endOffset: editEnd,
      insertedBytes,
    });
    editStart = null;
    insertedBytes = 0;
  };
  for (const operation of operations) {
    if (operation === "equal") {
      flush();
      oldOffset += 1;
      editEnd = oldOffset;
    } else if (operation === "delete") {
      editStart ??= oldOffset;
      oldOffset += 1;
      editEnd = oldOffset;
    } else {
      editStart ??= oldOffset;
      editEnd = oldOffset;
      insertedBytes += 1;
    }
  }
  flush();
  return Object.freeze(edits);
}

function hasSplitSurrogate(text: string, offset: number): boolean {
  if (offset <= 0 || offset >= text.length) return false;
  const previous = text.charCodeAt(offset - 1);
  const next = text.charCodeAt(offset);
  return (
    previous >= 0xd800 &&
    previous <= 0xdbff &&
    next >= 0xdc00 &&
    next <= 0xdfff
  );
}

function toByteRange(
  text: string,
  range: Utf16Range,
): ByteRange | null {
  if (
    !Number.isSafeInteger(range.startOffset) ||
    !Number.isSafeInteger(range.endOffset) ||
    range.startOffset < 0 ||
    range.startOffset >= range.endOffset ||
    range.endOffset > text.length ||
    hasSplitSurrogate(text, range.startOffset) ||
    hasSplitSurrogate(text, range.endOffset)
  ) {
    return null;
  }
  return {
    startOffset: Buffer.byteLength(
      text.slice(0, range.startOffset),
      "utf8",
    ),
    endOffset: Buffer.byteLength(
      text.slice(0, range.endOffset),
      "utf8",
    ),
  };
}

function baseEntityRange(
  text: string,
  declaration: DeclarationNode<TargetDeclarationKind>,
  field: AdvanceDestructiveRecordV1["field"],
): Utf16Range | null {
  if (field === "declaration") {
    const edit = deleteDeclarationEdit(
      declaration,
      splitPhysicalLines(text),
    );
    return {
      startOffset: edit.startOffset,
      endOffset: edit.endOffset,
    };
  }
  if (declaration.kind !== "milestone") return null;
  const state = fieldNamed(declaration, "state");
  return state === undefined
    ? null
    : {
        startOffset: state.valueSpan.start.offset,
        endOffset: state.valueSpan.end.offset,
      };
}

function matchingDeclarations(
  document: DocumentNode<TargetDeclarationKind>,
  record: AdvanceDestructiveRecordV1,
): readonly DeclarationNode<TargetDeclarationKind>[] {
  return document.declarations.filter(
    ({ kind, id }) =>
      kind === record.entityKind &&
      id === record.entityId,
  );
}

function bytesEqual(
  left: Uint8Array,
  leftRange: ByteRange,
  right: Uint8Array,
  rightRange: ByteRange,
): boolean {
  return Buffer.from(
    left.subarray(leftRange.startOffset, leftRange.endOffset),
  ).equals(
    Buffer.from(
      right.subarray(rightRange.startOffset, rightRange.endOffset),
    ),
  );
}

function editOverlaps(
  edit: RawByteEditV1,
  range: ByteRange,
): boolean {
  if (edit.startOffset === edit.endOffset) {
    return (
      edit.insertedBytes > 0 &&
      edit.startOffset > range.startOffset &&
      edit.startOffset < range.endOffset
    );
  }
  return (
    edit.startOffset < range.endOffset &&
    edit.endOffset > range.startOffset
  );
}

function assessment(
  status: AdvanceHistoryAssessment["status"],
  cause: AdvanceHistoryAssessmentCause,
  destructiveEntityIds: readonly string[],
  overlappingEntityIds: readonly string[],
): AdvanceHistoryAssessment {
  return Object.freeze({
    modelVersion: ADVANCE_HISTORY_SAFETY_MODEL_VERSION,
    status,
    cause,
    destructiveEntityIds: Object.freeze([...destructiveEntityIds]),
    overlappingEntityIds: Object.freeze([...overlappingEntityIds]),
  });
}

export function assessAdvanceHistorySafety(
  input: AdvanceHistoryAssessmentInput,
): AdvanceHistoryAssessment {
  const destructiveEntityIds = [
    ...new Set(input.destructiveRecords.map(({ entityId }) => entityId)),
  ].sort(compareStableStrings);
  if (
    input.currentDocument.text !== input.currentText ||
    input.headDocument.text !== input.headText ||
    !Buffer.from(input.currentSource).equals(
      Buffer.from(input.currentText, "utf8"),
    ) ||
    !Buffer.from(input.headSource).equals(
      Buffer.from(input.headText, "utf8"),
    )
  ) {
    return assessment(
      "blocked",
      "baseline_invalid",
      destructiveEntityIds,
      [],
    );
  }

  const recordKeys = input.destructiveRecords.map(
    ({ entityKind, entityId, field }) =>
      `${entityKind}:${entityId}:${field}`,
  );
  if (new Set(recordKeys).size !== recordKeys.length) {
    return assessment(
      "blocked",
      "correspondence_ambiguous",
      destructiveEntityIds,
      [],
    );
  }

  const declarationRecordKeys = new Set(
    input.destructiveRecords
      .filter(({ field }) => field === "declaration")
      .map(({ entityKind, entityId }) => `${entityKind}:${entityId}`),
  );
  const currentDeclarationRanges = new Map(
    planAdvanceDeclarationDeletions(
      input.currentText,
      input.currentDocument,
      ({ kind, id }) => declarationRecordKeys.has(`${kind}:${id}`),
    ).map(({ declaration, edit }) => [
      `${declaration.kind}:${declaration.id}`,
      { startOffset: edit.startOffset, endOffset: edit.endOffset },
    ] as const),
  );

  const indexEdits = rawByteEditsV1(input.headSource, input.indexSource);
  const overlapping = new Set<string>();
  let missing = false;
  let ambiguous = false;
  let invalid = false;
  for (const record of input.destructiveRecords) {
    const currentMatches = matchingDeclarations(
      input.currentDocument,
      record,
    );
    const headMatches = matchingDeclarations(input.headDocument, record);
    if (currentMatches.length > 1 || headMatches.length > 1) {
      ambiguous = true;
      continue;
    }
    if (currentMatches.length === 0 || headMatches.length === 0) {
      missing = true;
      continue;
    }
    const currentBaseRange = baseEntityRange(
      input.currentText,
      currentMatches[0]!,
      record.field,
    );
    const headBaseRange = baseEntityRange(
      input.headText,
      headMatches[0]!,
      record.field,
    );
    const currentRange = record.field === "declaration"
      ? currentDeclarationRanges.get(`${record.entityKind}:${record.entityId}`) ?? null
      : currentBaseRange;
    if (
      currentRange === null ||
      currentBaseRange === null ||
      headBaseRange === null ||
      currentRange.startOffset !== record.startOffset ||
      currentRange.endOffset !== record.endOffset
    ) {
      invalid = true;
      continue;
    }
    let headRange = headBaseRange;
    if (record.field === "declaration") {
      const prefix = input.currentText.slice(
        currentRange.startOffset,
        currentBaseRange.startOffset,
      );
      const suffix = input.currentText.slice(
        currentBaseRange.endOffset,
        currentRange.endOffset,
      );
      const headOwnedPrefixStart = advanceOwnedTerminalSeparatorStart(
        input.headText,
        headMatches[0]!,
      );
      const headOwnedPrefix = input.headText.slice(
        headOwnedPrefixStart,
        headBaseRange.startOffset,
      );
      const headStart = prefix === ""
        ? headBaseRange.startOffset
        : headOwnedPrefixStart;
      const headEnd = suffix === ""
        ? headBaseRange.endOffset
        : input.headText.length;
      if (
        (prefix !== "" && headOwnedPrefix !== prefix) ||
        (suffix !== "" && input.headText.slice(headBaseRange.endOffset) !== suffix)
      ) {
        overlapping.add(record.entityId);
        continue;
      }
      headRange = { startOffset: headStart, endOffset: headEnd };
    }
    const currentByteRange = toByteRange(
      input.currentText,
      currentRange,
    );
    const headByteRange = toByteRange(input.headText, headRange);
    if (
      currentByteRange === null ||
      headByteRange === null ||
      currentByteRange.endOffset > input.currentSource.length ||
      headByteRange.endOffset > input.headSource.length
    ) {
      invalid = true;
      continue;
    }
    if (
      !bytesEqual(
        input.currentSource,
        currentByteRange,
        input.headSource,
        headByteRange,
      ) ||
      indexEdits.some((edit) => editOverlaps(edit, headByteRange))
    ) {
      overlapping.add(record.entityId);
    }
  }

  const overlappingEntityIds = [...overlapping].sort(compareStableStrings);
  if (ambiguous) {
    return assessment(
      "blocked",
      "correspondence_ambiguous",
      destructiveEntityIds,
      overlappingEntityIds,
    );
  }
  if (missing) {
    return assessment(
      "blocked",
      "correspondence_missing",
      destructiveEntityIds,
      overlappingEntityIds,
    );
  }
  if (invalid) {
    return assessment(
      "blocked",
      "baseline_invalid",
      destructiveEntityIds,
      overlappingEntityIds,
    );
  }
  if (overlappingEntityIds.length > 0) {
    return assessment(
      "blocked",
      "destructive_overlap",
      destructiveEntityIds,
      overlappingEntityIds,
    );
  }
  return assessment(
    "passed",
    "baseline_matches",
    destructiveEntityIds,
    [],
  );
}
