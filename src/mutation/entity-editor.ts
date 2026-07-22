import type { DeclarationNode } from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import {
  contentTextEndOffset,
  deleteFieldEdit,
  fieldInsertionOffset,
  insertionText,
  majorLineEnding,
  serializeTags,
  serializeTextField,
  splitPhysicalLines,
} from "./source.js";
import type { TextEdit } from "./text-edits.js";

export class EntityEditor {
  readonly lineEnding: "\n" | "\r\n";
  readonly #text: string;
  readonly #declaration: DeclarationNode;
  readonly #lines: ReturnType<typeof splitPhysicalLines>;
  readonly #fieldRank: ReadonlyMap<string, number>;
  readonly #deleted: Set<string>;
  readonly #edits: TextEdit[] = [];
  readonly #additions = new Map<number, Array<{ name: string; serialized: string }>>();

  constructor(
    text: string,
    declaration: DeclarationNode,
    fieldOrder: readonly string[],
    deleted: readonly string[] = [],
  ) {
    this.#text = text;
    this.#declaration = declaration;
    this.#lines = splitPhysicalLines(text);
    this.lineEnding = majorLineEnding(text);
    this.#fieldRank = new Map(fieldOrder.map((name, index) => [name, index]));
    this.#deleted = new Set(deleted);
  }

  fieldValue(name: string): unknown {
    return fieldNamed(this.#declaration, name)?.value;
  }

  clear(name: string): void {
    this.#deleted.add(name);
  }

  queue(name: string, serialized: string): void {
    const offset = fieldInsertionOffset(
      this.#declaration,
      name,
      this.#deleted,
      this.#lines,
      this.#fieldRank,
    );
    const entries = this.#additions.get(offset) ?? [];
    entries.push({ name, serialized });
    this.#additions.set(offset, entries);
  }

  setScalar(name: string, valueText: string): void {
    const field = fieldNamed(this.#declaration, name);
    if (field === undefined) {
      this.queue(name, `  ${name} ${valueText}`);
      return;
    }
    this.#edits.push({
      startOffset: field.valueSpan.start.offset,
      endOffset: field.valueSpan.end.offset,
      replacement: valueText,
    });
  }

  setText(name: string, value: string): void {
    const field = fieldNamed(this.#declaration, name);
    if (field === undefined) {
      this.queue(name, serializeTextField(name, value, this.lineEnding));
    } else if (field.contentSpan === undefined && !value.includes("\n")) {
      this.#edits.push({
        startOffset: field.valueSpan.start.offset,
        endOffset: field.valueSpan.end.offset,
        replacement: JSON.stringify(value),
      });
    } else {
      this.#edits.push({
        startOffset: field.span.start.offset,
        endOffset: contentTextEndOffset(field, this.#lines),
        replacement: serializeTextField(name, value, this.lineEnding),
      });
    }
  }

  setTags(tags: readonly string[]): void {
    const field = fieldNamed(this.#declaration, "tags");
    if (tags.length === 0) {
      if (field !== undefined) this.clear("tags");
    } else if (field === undefined) {
      this.queue("tags", `  tags ${serializeTags(tags)}`);
    } else {
      this.#edits.push({
        startOffset: field.valueSpan.start.offset,
        endOffset: field.valueSpan.end.offset,
        replacement: serializeTags(tags),
      });
    }
  }

  finish(): readonly TextEdit[] {
    for (const name of this.#deleted) {
      const field = fieldNamed(this.#declaration, name);
      if (field !== undefined) this.#edits.push(deleteFieldEdit(field, this.#lines));
    }
    for (const [offset, entries] of this.#additions) {
      entries.sort(
        (left, right) =>
          (this.#fieldRank.get(left.name) ?? 99) - (this.#fieldRank.get(right.name) ?? 99),
      );
      this.#edits.push({
        startOffset: offset,
        endOffset: offset,
        replacement: insertionText(
          this.#text,
          offset,
          entries.map(({ serialized }) => serialized),
          this.lineEnding,
        ),
      });
    }
    return this.#edits;
  }
}

export function stringList(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
