interface DiffLine {
  readonly text: string;
  readonly terminated: boolean;
}

export interface UnifiedDiffOptions {
  readonly originalLabel?: string;
  readonly updatedLabel?: string;
  readonly contextLines?: number;
}

function splitLines(text: string): readonly DiffLine[] {
  if (text.length === 0) return [];
  const lines: DiffLine[] = [];
  let start = 0;
  while (start < text.length) {
    const newline = text.indexOf("\n", start);
    if (newline === -1) {
      lines.push({ text: text.slice(start), terminated: false });
      break;
    }
    const end = newline > start && text[newline - 1] === "\r" ? newline - 1 : newline;
    lines.push({ text: text.slice(start, end), terminated: true });
    start = newline + 1;
  }
  return lines;
}

function sameLine(left: DiffLine, right: DiffLine): boolean {
  return left.text === right.text && left.terminated === right.terminated;
}

function safeLabel(value: string): string {
  return value.replace(/[\r\n]+/g, " ");
}

function range(startIndex: number, count: number): string {
  const start = count === 0 ? startIndex : startIndex + 1;
  return `${start},${count}`;
}

function appendLine(output: string[], prefix: " " | "+" | "-", line: DiffLine): void {
  output.push(`${prefix}${line.text}`);
  if (!line.terminated) output.push("\\ No newline at end of file");
}

export function createUnifiedDiff(
  original: string,
  updated: string,
  options: UnifiedDiffOptions = {},
): string {
  if (original === updated) return "";
  const originalLines = splitLines(original);
  const updatedLines = splitLines(updated);
  let prefix = 0;
  while (
    prefix < originalLines.length &&
    prefix < updatedLines.length &&
    sameLine(originalLines[prefix]!, updatedLines[prefix]!)
  ) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < originalLines.length - prefix &&
    suffix < updatedLines.length - prefix &&
    sameLine(
      originalLines[originalLines.length - suffix - 1]!,
      updatedLines[updatedLines.length - suffix - 1]!,
    )
  ) {
    suffix += 1;
  }

  const requestedContext = options.contextLines ?? 3;
  if (!Number.isSafeInteger(requestedContext) || requestedContext < 0) {
    throw new RangeError("contextLines must be a nonnegative integer");
  }
  const leadingContext = Math.min(prefix, requestedContext);
  const trailingContext = Math.min(suffix, requestedContext);
  const originalStart = prefix - leadingContext;
  const updatedStart = prefix - leadingContext;
  const originalChangeEnd = originalLines.length - suffix;
  const updatedChangeEnd = updatedLines.length - suffix;
  const originalEnd = originalChangeEnd + trailingContext;
  const updatedEnd = updatedChangeEnd + trailingContext;
  const output = [
    `--- ${safeLabel(options.originalLabel ?? "original")}`,
    `+++ ${safeLabel(options.updatedLabel ?? "updated")}`,
    `@@ -${range(originalStart, originalEnd - originalStart)} +${range(updatedStart, updatedEnd - updatedStart)} @@`,
  ];

  for (let index = originalStart; index < prefix; index += 1) {
    appendLine(output, " ", originalLines[index]!);
  }
  for (let index = prefix; index < originalChangeEnd; index += 1) {
    appendLine(output, "-", originalLines[index]!);
  }
  for (let index = prefix; index < updatedChangeEnd; index += 1) {
    appendLine(output, "+", updatedLines[index]!);
  }
  for (let index = 0; index < trailingContext; index += 1) {
    appendLine(output, " ", originalLines[originalChangeEnd + index]!);
  }
  return `${output.join("\n")}\n`;
}
