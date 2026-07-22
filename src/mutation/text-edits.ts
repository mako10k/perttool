export interface TextEdit {
  readonly startOffset: number;
  readonly endOffset: number;
  readonly replacement: string;
}

export function normalizeTextEdits(
  text: string,
  edits: readonly TextEdit[],
  source = "operation",
): readonly TextEdit[] {
  for (const edit of edits) {
    if (
      !Number.isSafeInteger(edit.startOffset) ||
      !Number.isSafeInteger(edit.endOffset) ||
      edit.startOffset < 0 ||
      edit.endOffset < edit.startOffset ||
      edit.endOffset > text.length
    ) {
      throw new Error(`${source} generated an invalid TextEdit range`);
    }
  }
  const sorted = edits
    .filter((edit) => text.slice(edit.startOffset, edit.endOffset) !== edit.replacement)
    .sort(
      (left, right) =>
        left.startOffset - right.startOffset || left.endOffset - right.endOffset,
    );
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]!;
    const current = sorted[index]!;
    const duplicateInsertion =
      previous.startOffset === previous.endOffset &&
      current.startOffset === current.endOffset &&
      previous.startOffset === current.startOffset;
    if (current.startOffset < previous.endOffset || duplicateInsertion) {
      throw new Error(`${source} generated overlapping TextEdit ranges`);
    }
  }
  return sorted;
}

export function applyTextEdits(text: string, edits: readonly TextEdit[]): string {
  let updated = text;
  for (const edit of [...edits].reverse()) {
    updated = `${updated.slice(0, edit.startOffset)}${edit.replacement}${updated.slice(edit.endOffset)}`;
  }
  return updated;
}
