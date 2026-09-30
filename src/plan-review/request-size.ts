// R: Bound canonical Plan Review batch JSON bytes before serialization.

const shortEscapes = new Set([0x22, 0x5c, 8, 9, 10, 12, 13]);

/** Count canonical JSON bytes without constructing escaped strings or JSON. */
export function planReviewBatchFitsUtf8(value: unknown, maximum: number): boolean {
  let bytes = 0;
  const active = new Set<object>();
  function add(count: number): boolean {
    bytes += count;
    return bytes <= maximum;
  }
  function string(text: string): boolean {
    if (!add(2)) return false;
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      let width: number;
      if (shortEscapes.has(code)) width = 2;
      else if (code < 0x20) width = 6;
      else if (code < 0x80) width = 1;
      else if (code < 0x800) width = 2;
      else if (code >= 0xd800 && code <= 0xdbff) {
        const next = text.charCodeAt(index + 1);
        if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
        index += 1;
        width = 4;
      } else if (code >= 0xdc00 && code <= 0xdfff) return false;
      else width = 3;
      if (!add(width)) return false;
    }
    return true;
  }
  function array(items: readonly unknown[]): boolean {
    for (let index = 0; index < items.length; index += 1) {
      if ((index > 0 && !add(1)) || !visit(items[index])) return false;
    }
    return true;
  }
  function object(item: Record<string, unknown>): boolean {
    let first = true;
    for (const key of Object.keys(item)) {
      if ((!first && !add(1)) || !string(key) || !add(1) || !visit(item[key])) return false;
      first = false;
    }
    return true;
  }
  function visit(item: unknown): boolean {
    if (item === null) return add(4);
    if (typeof item === "string") return string(item);
    if (typeof item === "boolean") return add(item ? 4 : 5);
    if (typeof item === "number") {
      return Number.isSafeInteger(item) && add(String(item).length);
    }
    if (typeof item !== "object" || active.has(item)) return false;
    active.add(item);
    try {
      if (!add(2)) return false;
      return Array.isArray(item) ? array(item) : object(item as Record<string, unknown>);
    } finally {
      active.delete(item);
    }
  }
  try {
    return visit(value);
  } catch {
    return false;
  }
}
