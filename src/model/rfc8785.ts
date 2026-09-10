function jsonString(value: string): string {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) {
        throw new Error("RFC 8785 input contains a lone high surrogate");
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new Error("RFC 8785 input contains a lone low surrogate");
    }
  }
  return JSON.stringify(value);
}

function jsonObject(value: Readonly<Record<string, unknown>>): string {
  const fields = Object.keys(value).sort().map((key) => {
    const item = value[key];
    if (item === undefined) throw new Error(`RFC 8785 field ${key} is undefined`);
    return `${jsonString(key)}:${rfc8785Json(item)}`;
  });
  return `{${fields.join(",")}}`;
}

export function rfc8785Json(value: unknown): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return jsonString(value);
    case "boolean":
      return String(value);
    case "number":
      if (!Number.isSafeInteger(value)) {
        throw new Error("RFC 8785 number is not a safe integer");
      }
      return String(value);
    case "object":
      return Array.isArray(value)
        ? `[${value.map(rfc8785Json).join(",")}]`
        : jsonObject(value as Readonly<Record<string, unknown>>);
    default:
      throw new Error("RFC 8785 value is unsupported");
  }
}
