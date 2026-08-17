import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { composeContract9TemporalMutation } from "../dist/application/contract9-mixed-mutation.js";
import { planContract9TemporalMutation } from "../dist/application/contract9-temporal-mutation.js";
import { persistContract9Mutation } from "../dist/application/contract9-write.js";
import { validateContract9CommandInvocation } from "../dist/command/contract9-usage.js";

const source = `${["project WRITE:", "  version 8", '  title "Write"', "  as_of 2026-08-17T09:00:00+09:00", "  duration_unit hour", "  finish END", '  time_zone "Asia/Tokyo"', '  tzdb "2026c"', "  calendar STANDARD", "", "calendar STANDARD:", "  mon 09:00..17:00", "", "milestone START:", '  title "Start"', "  state reached", "", "milestone END:", '  title "End"', "", "task WORK START -> END:", '  title "Work"', "  duration 1h"].join("\n")}\n`;
const invocation = validateContract9CommandInvocation(["calendar", "set", "plan.pert", "STANDARD", "--weekday", "mon 10:00..16:00"]);

test("ordinary Contract 9 maintenance shares preview, out, and in-place candidate bytes", async () => {
  assert.equal(invocation.ok, true);
  const result = composeContract9TemporalMutation(source, (text) => planContract9TemporalMutation(text, invocation));
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.governance, null);
  assert.equal((await persistContract9Mutation(result, { mode: "preview" })).written, false);
  const directory = await mkdtemp(path.join(tmpdir(), "perttool-contract9-write-"));
  try {
    const input = path.join(directory, "input.pert"); const output = path.join(directory, "output.pert");
    await writeFile(input, source);
    assert.equal((await persistContract9Mutation(result, { mode: "out", target: output })).written, true);
    assert.equal(await readFile(output, "utf8"), result.updatedText);
    assert.equal((await persistContract9Mutation(result, { mode: "in_place", target: input, expectedDigest: result.originalDigest })).written, true);
    assert.equal(await readFile(input, "utf8"), result.updatedText);
    await assert.rejects(() => persistContract9Mutation(result, { mode: "in_place", target: input, expectedDigest: result.originalDigest }), /changed after the initial read|digest/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
