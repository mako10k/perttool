import { canonicalizeExactDurationSourceToken } from "./exact-duration-source.js";

export function canonicalizeExactPersonHoursSourceToken(
  source: string,
): string | null {
  if (!source.endsWith("ph")) return null;
  const canonical = canonicalizeExactDurationSourceToken(
    `${source.slice(0, -2)}h`,
  );
  if (canonical === null) return null;
  return `${canonical.token.slice(0, -1)}ph`;
}
