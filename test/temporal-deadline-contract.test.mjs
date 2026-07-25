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

test("deadline contract fixes identities, subjects, and historical boundaries", async () => {
  const specification = await repositoryFile("docs/specs/temporal-deadline.md");

  assert.match(specification, /Document status: Normative 1\.0/);
  assert.match(
    specification,
    /Deadline evaluation ID: `perttool\.deadline-evaluation`/,
  );
  assert.match(
    specification,
    /Temporal precedence projection ID: `perttool\.temporal-precedence-earliest`/,
  );
  assert.match(
    specification,
    /Temporal resource projection ID: `perttool\.temporal-parallel-sgs`/,
  );
  assert.match(
    specification,
    /The deadline on the milestone referenced by `project\.finish` additionally has\s+the role `project_finish`/,
  );
  assert.match(
    specification,
    /complete_actual_time_unavailable/,
  );
  assert.match(
    specification,
    /MUST NOT substitute relative time zero as an actual\s+finish/,
  );
});

test("deadline contract fixes release-aware precedence and resource projections", async () => {
  const specification = await repositoryFile("docs/specs/temporal-deadline.md");

  assert.match(
    specification,
    /temporal_precedence_start\(t\) =\s+max\(temporal_milestone_time\(src\(t\)\), release_bound\(t\)\)/,
  );
  assert.match(
    specification,
    /current simulated time >= release_bound\(t\)/,
  );
  assert.match(
    specification,
    /advance simulated time to the\s+smallest such release bound/,
  );
  assert.match(
    specification,
    /The result is a constructed feasible schedule under its modeled capacities/,
  );
  assert.match(specification, /deterministic and `optimal=false`/);
  assert.match(
    specification,
    /do not return a temporal\s+resource projection for that deadline subject/,
  );
});

test("deadline contract fixes current state, margin sign, and feasibility meaning", async () => {
  const specification = await repositoryFile("docs/specs/temporal-deadline.md");

  for (const expected of [
    "not_due  if as_of < deadline",
    "due_now if as_of == deadline",
    "overdue if as_of > deadline",
    "positive margin means completion before the deadline",
    "zero means completion exactly on the deadline",
    "negative margin means forecast lateness",
    "lower_bound_on_time",
    "lower_bound_late",
    "heuristic_on_time",
    "heuristic_late",
  ]) {
    assert.ok(specification.includes(expected), expected);
  }

  assert.match(
    specification,
    /`lower_bound_late` means even the temporal precedence earliest projection\s+finishes after the deadline/,
  );
  assert.match(
    specification,
    /`heuristic_late` reports that the selected deterministic heuristic misses/,
  );
  assert.match(
    specification,
    /Because `optimal=false`, it is not proof of infeasibility/,
  );
});

test("deadline contract fixes risk, block, relationship, and recommendation boundaries", async () => {
  const specification = await repositoryFile("docs/specs/temporal-deadline.md");
  const requirements = await repositoryFile("docs/requirements.md");
  const design = await repositoryFile("docs/basic-design.md");
  const analysis = await repositoryFile("docs/specs/analysis.md");
  const recommendation = await repositoryFile("docs/specs/recommendation.md");
  const ranking = await repositoryFile("docs/specs/recommendation-ranking.md");

  assert.match(
    specification,
    /else if resource_deadline_assessment == heuristic_late:\s+combined = at_risk/,
  );
  assert.match(
    specification,
    /`at_risk` is a deterministic resource-delay state, not a statistical risk\s+score/,
  );
  assert.match(
    specification,
    /conditional_on_blocks_resolved = blocked_task_ids is not empty/,
  );
  assert.match(
    specification,
    /task_deadline_before_milestone[\s\S]*same_deadline[\s\S]*task_deadline_after_milestone/,
  );
  assert.match(
    specification,
    /Recommendation Reason Taxonomy version 1\.0 gains no deadline reason code/,
  );
  assert.match(
    specification,
    /a complete `Perttool\.NextResult\.v3` retains exactly its existing authority/,
  );
  assert.match(
    requirements,
    /- \[x\] \[Deadline-derived analysis and recommendation semantics\]\(specs\/temporal-deadline\.md\)/,
  );
  assert.match(design, /### 6\.5 Temporal Deadline Evaluation/);
  assert.match(
    analysis,
    /Temporal release scheduling and deadline evaluation/,
  );
  assert.match(
    recommendation,
    /deadline facts informational until an explicit ranking, taxonomy,\s+explanation, and result-schema version change/,
  );
  assert.match(
    ranking,
    /deadline\s+margin or lateness, and deadline assessment/,
  );
});
