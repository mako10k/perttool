import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

async function repositoryFile(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("calendar contract fixes identity, tagged values, and exact comparison", async () => {
  const specification = await repositoryFile("docs/specs/temporal-calendar.md");

  assert.match(specification, /Document status: Normative 1\.0/);
  assert.match(
    specification,
    /Calendar arithmetic ID: `perttool\.calendar-projection`/,
  );
  assert.match(
    specification,
    /Calendar profile ID: `perttool\.calendar\.continuous-fixed-offset`/,
  );
  assert.match(
    specification,
    /The two kinds are not implicit precision variants of one value/,
  );
  assert.match(
    specification,
    /Compare two dates by `civil_day_number`/,
  );
  assert.match(
    specification,
    /Compare two date-times by `instant_key`/,
  );
  assert.match(
    specification,
    /A date and a date-time are `incomparable_temporal_kinds`/,
  );
  assert.match(
    specification,
    /MUST\s+NOT round it to milliseconds or binary floating point/,
  );
});

test("calendar contract fixes the complete projection and velocity matrix", async () => {
  const specification = await repositoryFile("docs/specs/temporal-calendar.md");

  for (const row of [
    "| `day` | `day` | the base Rational |",
    "| `hour` | `hour` | the base Rational |",
    "| `point` with `Pp/Td` | `day` | `x * T / P` |",
    "| `point` with `Pp/Th` | `hour` | `x * T / P` |",
    "| `date` | `day` | available only for an integer value |",
    "| `date` | `hour` | unavailable | `date_anchor_has_no_clock` |",
    "| `date-time` | `day` | available | add the exact Rational value multiplied by 86400 SI seconds |",
    "| `date-time` | `hour` | available | add the exact Rational value multiplied by 3600 SI seconds |",
  ]) {
    assert.ok(specification.includes(row), row);
  }

  assert.match(
    specification,
    /does not establish a relationship between `day` and `hour`/,
  );
  assert.match(
    specification,
    /MUST NOT be exposed as a general `day <-> hour`\s+conversion, used by unit migration/,
  );
  assert.match(
    specification,
    /A non-integer day value projected from a date anchor is\s+`fractional_date_projection`/,
  );
});

test("calendar contract fixes snapshot, not-before, and calendar boundaries", async () => {
  const specification = await repositoryFile("docs/specs/temporal-calendar.md");
  const requirements = await repositoryFile("docs/requirements.md");
  const design = await repositoryFile("docs/basic-design.md");
  const analysis = await repositoryFile("docs/specs/analysis.md");

  assert.match(
    specification,
    /`project\.as_of` is the only temporal anchor/,
  );
  assert.match(
    specification,
    /If `not_before <= as_of`, the temporal release bound is zero/,
  );
  assert.match(
    specification,
    /The task remains structurally `ready`, not\s+`blocked`/,
  );
  assert.match(
    specification,
    /Every successive Gregorian date is one calendar day, including Saturdays,\s+Sundays, and holidays/,
  );
  assert.match(
    specification,
    /No daylight-saving gap or overlap exists/,
  );
  assert.match(
    requirements,
    /- \[x\] \[Deterministic date\/date-time, `as_of`, timezone, and calendar semantics\]\(specs\/temporal-calendar\.md\)/,
  );
  assert.match(design, /### 6\.4 Temporal Calendar Projection/);
  assert.match(
    analysis,
    /Calendar projection, which composes over exact Analysis version 1 results/,
  );
});
