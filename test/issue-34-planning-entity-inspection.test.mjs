import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { COMMAND_REGISTRY } from "../dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "dist", "cli.js");
const fixture = path.join(root, "test", "fixtures", "issue-34-planning-entities.pert");
const goldenRoot = path.join(root, "test", "golden", "planning-pool-human");
const schemaBase = "https://github.com/mako10k/perttool/schemas/";

function run(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, expectedStatus, `${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return result;
}

function json(args, expectedStatus = 0) {
  return JSON.parse(run([...args, "--format", "json"], expectedStatus).stdout);
}

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const schemaRoot = path.join(root, "schemas");
  for (const file of readdirSync(schemaRoot).filter((name) => name.endsWith(".schema.json"))) {
    ajv.addSchema(JSON.parse(readFileSync(path.join(schemaRoot, file), "utf8")));
  }
  return ajv.getSchema(`${schemaBase}Perttool.PlanningPoolResult.v1.schema.json`);
}

test("Issue #34 publishes four read-only Event and Activity inspection commands", () => {
  const operations = ["event.list", "event.show", "activity.list", "activity.show"];
  for (const operation of operations) {
    const descriptor = COMMAND_REGISTRY.find((entry) => entry.operation === operation);
    assert.notEqual(descriptor, undefined, operation);
    assert.equal(descriptor.contractVersion, 10);
    assert.equal(descriptor.effect, "read");
    assert.equal(descriptor.output.fileEffect, "none");
    assert.deepEqual(descriptor.resultSchemas, [
      "Perttool.PlanningPoolResult.v1",
      "Perttool.CliError.v1",
    ]);
    assert.deepEqual(
      descriptor.options.map(({ name }) => name),
      ["format", "color", "max-diagnostics", "warnings-as-errors"],
    );
  }
  assert.equal(COMMAND_REGISTRY.length, 71);
});

test("Issue #34 keeps Event and Activity lists compact and project-owned", () => {
  assert.equal(
    run(["event", "list", fixture]).stdout,
    [
      "ENTITY_INSPECTION::READY\tReview input is ready",
      "ENTITY_INSPECTION::ACCEPTED\tReview is accepted",
      "",
    ].join("\n"),
  );
  assert.equal(
    run(["activity", "list", fixture]).stdout,
    "ENTITY_INSPECTION::REVIEW\tENTITY_INSPECTION::READY -> ENTITY_INSPECTION::ACCEPTED\tReview the shared transition\n",
  );

  const events = json(["event", "list", fixture]);
  const activities = json(["activity", "list", fixture]);
  assert.deepEqual(events.events.map(({ qualified_id }) => qualified_id), [
    "ENTITY_INSPECTION::READY",
    "ENTITY_INSPECTION::ACCEPTED",
  ]);
  assert.deepEqual(activities.activities.map(({ qualified_id }) => qualified_id), [
    "ENTITY_INSPECTION::REVIEW",
  ]);
  assert.deepEqual(events.works, []);
  assert.deepEqual(activities.works, []);
});

test("Issue #34 renders complete Event and Activity detail with shared reverse Work associations", () => {
  const eventText = run(["event", "show", fixture, "READY"]).stdout;
  const eventQualifiedText = run([
    "event", "show", fixture, "ENTITY_INSPECTION::READY",
  ]).stdout;
  const activityText = run(["activity", "show", fixture, "REVIEW"]).stdout;
  const activityQualifiedText = run([
    "activity", "show", fixture, "ENTITY_INSPECTION::REVIEW",
  ]).stdout;
  assert.equal(eventText, readFileSync(path.join(goldenRoot, "event-show.expected.txt"), "utf8"));
  assert.equal(eventQualifiedText, eventText);
  assert.equal(activityText, readFileSync(path.join(goldenRoot, "activity-show.expected.txt"), "utf8"));
  assert.equal(activityQualifiedText, activityText);

  const event = json(["event", "show", fixture, "READY"]);
  const activity = json(["activity", "show", fixture, "REVIEW"]);
  const sharedWorks = ["ENTITY_INSPECTION::FIRST", "ENTITY_INSPECTION::SECOND"];
  assert.deepEqual(event.works.map(({ qualified_id }) => qualified_id), sharedWorks);
  assert.deepEqual(activity.works.map(({ qualified_id }) => qualified_id), sharedWorks);
  assert.equal(event.events[0].qualified_id, "ENTITY_INSPECTION::READY");
  assert.equal(activity.activities[0].from.qualified_id, "ENTITY_INSPECTION::READY");
  assert.equal(activity.activities[0].to.qualified_id, "ENTITY_INSPECTION::ACCEPTED");
  assert.equal(activity.activities[0].estimate.most_likely.source_text, "3p");
  assert.equal(activity.activities[0].requirements[0].qualified_resource_id, "ENTITY_INSPECTION::REVIEWERS");
  assert.deepEqual(activity.activities[0].when.map(({ event: kind, direction }) => [kind, direction]), [
    ["start", "earliest"],
    ["finish", "latest"],
  ]);
  assert.deepEqual(Object.keys(event.works[0].events[0]).sort(), ["id", "qualified_id", "span"]);

  const validate = validator();
  assert.equal(typeof validate, "function");
  for (const value of [event, activity]) {
    assert.equal(validate(value), true, JSON.stringify(validate.errors));
  }
});

test("Issue #34 returns stable missing-identity diagnostics, source spans, and no source write", () => {
  const before = readFileSync(fixture, "utf8");
  const missingEvent = json(["event", "show", fixture, "MISSING"], 1);
  const missingActivity = json(["activity", "show", fixture, "ENTITY_INSPECTION::MISSING"], 1);
  assert.equal(missingEvent.ok, false);
  assert.equal(missingEvent.diagnostics.some(({ code, message }) =>
    code === "PTPOOL-102" && message === "Event MISSING does not exist"), true);
  assert.equal(missingActivity.diagnostics.some(({ code, message }) =>
    code === "PTPOOL-102" && message === "Activity ENTITY_INSPECTION::MISSING does not exist"), true);

  const event = json(["event", "show", fixture, "READY"]).events[0];
  const activity = json(["activity", "show", fixture, "REVIEW"]).activities[0];
  for (const span of [
    event.span,
    event.id_span,
    event.title_span,
    event.description.span,
    activity.span,
    activity.id_span,
    activity.title_span,
    activity.from.span,
    activity.to.span,
    activity.estimate.span,
    activity.requirements[0].span,
    activity.when[0].span,
  ]) {
    assert.equal(Number.isInteger(span.start.offset), true);
    assert.equal(Number.isInteger(span.end.offset), true);
    assert.ok(span.end.offset > span.start.offset);
  }
  assert.equal(readFileSync(fixture, "utf8"), before);
});
