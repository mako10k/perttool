// R: Exercise the retained v9 Application result through the shared semantic wire projection for historical contract tests.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { selectNextTasks } from "../../dist/application/contract11-runtime.js";
import { projectNextResult } from "../../adapters/mcp/dist/projection.js";
import { TOOL_VERSION } from "../../dist/version.js";

export function legacyNextWire(file, options = {}) {
  const text = readFileSync(file, "utf8");
  const sourceDigest = `sha256:${createHash("sha256").update(text).digest("hex")}`;
  const result = selectNextTasks(text, { ...options, sourceDigest });
  return {
    schema_version: "Perttool.NextResult.v9", cli_contract_version: 11,
    recommendation_interface_version: 1, tool_version: TOOL_VERSION,
    operation: "dag.next", source: file, source_digest: sourceDigest,
    ...projectNextResult(result),
  };
}
