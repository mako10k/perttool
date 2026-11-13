// R: Project model-2 recommendation records into their closed snake-case wire representation.
export function dispatchModelToJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(dispatchModelToJson);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key.replace(/([a-z0-9])([A-Z])/gu, "$1_$2").toLowerCase(), dispatchModelToJson(item),
  ]));
}
