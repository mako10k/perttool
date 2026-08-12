import type {
  DeclarationNode,
  DocumentNode,
  TargetDeclarationKind,
} from "../model/syntax.js";
import {
  deleteDeclarationEdit,
  lineIndexAt,
  splitPhysicalLines,
} from "./source.js";
import type { TextEdit } from "./text-edits.js";

export interface AdvanceDeclarationDeletion {
  readonly declaration: DeclarationNode<TargetDeclarationKind>;
  readonly edit: TextEdit;
}

function terminalSeparatorStart(
  lines: ReturnType<typeof splitPhysicalLines>,
  ordinaryStart: number,
): number {
  let startOffset = ordinaryStart;
  let lineIndex = lineIndexAt(lines, startOffset);
  while (lineIndex > 0 && lines[lineIndex - 1]!.text.trim() === "") {
    lineIndex -= 1;
    startOffset = lines[lineIndex]!.start;
  }
  return startOffset;
}

export function advanceOwnedTerminalSeparatorStart(
  text: string,
  declaration: DeclarationNode<TargetDeclarationKind>,
): number {
  const lines = splitPhysicalLines(text);
  const ordinary = deleteDeclarationEdit(declaration, lines);
  return terminalSeparatorStart(lines, ordinary.startOffset);
}

/**
 * Plans declaration removals with the narrow terminal-separator ownership
 * selected by ADV-002. Ordinary non-terminal declaration removals retain the
 * existing source-preserving range.
 */
export function planAdvanceDeclarationDeletions(
  text: string,
  document: DocumentNode<TargetDeclarationKind>,
  remove: (declaration: DeclarationNode<TargetDeclarationKind>) => boolean,
): readonly AdvanceDeclarationDeletion[] {
  if (document.text !== text) {
    throw new Error("advance deletion source does not match document");
  }

  const selected = new Set(document.declarations.filter(remove));
  const terminal = new Set<DeclarationNode<TargetDeclarationKind>>();
  for (let index = document.declarations.length - 1; index >= 0; index -= 1) {
    const declaration = document.declarations[index]!;
    if (!selected.has(declaration)) break;
    terminal.add(declaration);
  }

  const lines = splitPhysicalLines(text);
  const lastDeclaration = document.declarations.at(-1);
  let previousTerminalEnd: number | undefined;
  return document.declarations
    .filter((declaration) => selected.has(declaration))
    .map((declaration) => {
      const ordinary = deleteDeclarationEdit(declaration, lines);
      if (!terminal.has(declaration)) {
        return { declaration, edit: ordinary };
      }

      const desiredStart = terminalSeparatorStart(
        lines,
        ordinary.startOffset,
      );

      const endOffset = declaration === lastDeclaration &&
          text.slice(ordinary.endOffset).trim() === ""
        ? text.length
        : ordinary.endOffset;
      const startOffset = previousTerminalEnd === undefined
        ? desiredStart
        : Math.max(desiredStart, previousTerminalEnd);
      previousTerminalEnd = endOffset;
      return {
        declaration,
        edit: { startOffset, endOffset, replacement: "" },
      };
    });
}
