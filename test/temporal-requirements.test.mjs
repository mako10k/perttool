import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function section(text, start, end) {
  const match = text.match(new RegExp(`^${start}\\n(?<body>[\\s\\S]*?)(?=^${end})`, "m"));
  assert.ok(match);
  return match.groups.body;
}

test("temporal requirements fix the accepted entity and property scope", async () => {
  const requirements = await readFile(path.join(root, "docs/requirements.md"), "utf8");
  const temporal = section(
    requirements,
    "### 7\\.6 Temporal property scope",
    "## 8\\. DSL requirements",
  );

  const propertyRows = [...temporal.matchAll(
    /^\| (Project|Milestone|Task) \| `([^`]+)` \| (.+) \|$/gm,
  )].map((match) => [match[1], match[2], match[3]]);
  assert.deepEqual(propertyRows, [
    ["Project", "as_of", "Existing snapshot anchor for relative schedule time zero"],
    ["Milestone", "deadline", "Latest desired reach date or date-time"],
    ["Task", "not_before", "Earliest permitted start date or date-time for an unstarted task"],
    ["Task", "deadline", "Latest desired finish date or date-time"],
  ]);

  assert.match(temporal, /There is no separate `project\.deadline` alias|`project\.deadline`; use the finish milestone deadline/);
  assert.match(temporal, /temporal fields on resources or gates/);
  assert.match(temporal, /Require `project\.as_of` when `deadline` or `not_before` is declared/);
  assert.match(temporal, /A task can be\s+`ready` but not time-eligible or `runnable_now`/);
  assert.match(temporal, /Grammar version 1 keeps its current field set and meaning/);
  assert.match(temporal, /Result schemas that add temporal fields receive new schema identities/);
});

test("temporal requirements preserve base analysis and version recommendation changes", async () => {
  const requirements = await readFile(path.join(root, "docs/requirements.md"), "utf8");
  const temporal = section(
    requirements,
    "### 7\\.6 Temporal property scope",
    "## 8\\. DSL requirements",
  );
  const analysis = section(
    requirements,
    "### 10\\.7 Temporal projection and deadline evaluation",
    "## 11\\. Next-task determination",
  );

  assert.match(
    temporal,
    /Calendar projections and deadline evaluations are separate qualified\s+results and never replace those values/,
  );
  assert.match(
    temporal,
    /Any effect on recommendation eligibility, ranking, selection horizon, tier,\s+or reason taxonomy requires an explicit algorithm\/schema version change/,
  );
  assert.match(analysis, /precedence lower bound and the\s+heuristic resource schedule/);
  assert.match(analysis, /explicit unavailable result rather than inventing a timezone/);
  assert.match(
    requirements,
    /- \[x\] Temporal properties, entity scope, meanings, compatibility boundary, and non-goals/,
  );
  assert.match(
    requirements,
    /- \[x\] \[Deterministic date\/date-time, `as_of`, timezone, and calendar semantics\]\(specs\/temporal-calendar\.md\)/,
  );
  assert.match(
    requirements,
    /- \[x\] \[Deadline-derived analysis and recommendation semantics\]\(specs\/temporal-deadline\.md\)/,
  );
  assert.match(
    requirements,
    /- \[x\] \[Exact point and time-unit source-migration semantics\]\(specs\/unit-migration\.md\)/,
  );
});
