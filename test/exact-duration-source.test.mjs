import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as publicApi from "../dist/index.js";
import {
  serializeExactDurationSource,
} from "../dist/model/exact-duration-source.js";
import { rational } from "../dist/model/rational.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

const suffixes = {
  day: "d",
  hour: "h",
  point: "p",
};

function parseExactToken(result, unit) {
  const suffix = suffixes[unit];
  assert.ok(result.token.endsWith(suffix));
  const value = result.token.slice(0, -suffix.length);
  if (result.classification === "fraction") {
    assert.match(value, /^[0-9]+\/[1-9][0-9]*$/);
    const [numerator, denominator] = value.split("/");
    return rational(BigInt(numerator), BigInt(denominator));
  }
  assert.equal(result.classification, "decimal");
  assert.match(value, /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/);
  if (value.includes(".")) assert.doesNotMatch(value, /0$/);
  const [whole, fraction = ""] = value.split(".");
  return rational(BigInt(`${whole}${fraction}`), 10n ** BigInt(fraction.length));
}

test("exact Duration source serialization is internal and independent from display rounding", async () => {
  assert.equal("serializeExactDurationSource" in publicApi, false);
  const source = await readFile(
    path.join(root, "src/model/exact-duration-source.ts"),
    "utf8",
  );
  assert.doesNotMatch(source, /formatDecimal|precision|round/i);
});

test("terminating values use the shortest exact ordinary Decimal", () => {
  const cases = [
    [0n, 7n, "day", { classification: "decimal", token: "0d" }],
    [8n, 4n, "hour", { classification: "decimal", token: "2h" }],
    [1n, 2n, "day", { classification: "decimal", token: "0.5d" }],
    [1n, 8n, "hour", { classification: "decimal", token: "0.125h" }],
    [7n, 20n, "point", { classification: "decimal", token: "0.35p" }],
    [13n, 200n, "day", { classification: "decimal", token: "0.065d" }],
    [6n, 8n, "hour", { classification: "decimal", token: "0.75h" }],
    [1234500n, 1000n, "point", { classification: "decimal", token: "1234.5p" }],
  ];
  for (const [numerator, denominator, unit, expected] of cases) {
    assert.deepEqual(
      serializeExactDurationSource({ numerator, denominator }, unit),
      expected,
    );
  }
});

test("nonterminating values use a reduced Fraction and stable classification", () => {
  const cases = [
    [2n, 3n, "hour", "2/3h"],
    [4n, 6n, "point", "2/3p"],
    [10n, 3n, "day", "10/3d"],
    [14n, 42n, "hour", "1/3h"],
    [11n, 70n, "point", "11/70p"],
  ];
  for (const [numerator, denominator, unit, token] of cases) {
    const result = serializeExactDurationSource({ numerator, denominator }, unit);
    assert.deepEqual(result, { classification: "fraction", token });
    assert.equal(result.token.includes("/"), true);
  }
});

test("large integers and long terminating expansions remain exact", () => {
  const integer = 10n ** 180n + 123456789n;
  assert.deepEqual(serializeExactDurationSource(rational(integer), "point"), {
    classification: "decimal",
    token: `${integer}p`,
  });

  const scale = 120;
  const denominator = 10n ** BigInt(scale);
  assert.deepEqual(serializeExactDurationSource(rational(1n, denominator), "day"), {
    classification: "decimal",
    token: `0.${"0".repeat(scale - 1)}1d`,
  });

  const nonterminatingNumerator = 10n ** 160n + 1n;
  assert.deepEqual(
    serializeExactDurationSource(
      { numerator: nonterminatingNumerator, denominator: 3n },
      "hour",
    ),
    {
      classification: "fraction",
      token: `${nonterminatingNumerator}/3h`,
    },
  );
});

test("bounded Rational samples round-trip exactly and classification matches token syntax", () => {
  for (const unit of ["day", "hour", "point"]) {
    for (let numerator = 0n; numerator <= 60n; numerator += 1n) {
      for (let denominator = 1n; denominator <= 40n; denominator += 1n) {
        const input = rational(numerator, denominator);
        const first = serializeExactDurationSource(input, unit);
        const second = serializeExactDurationSource(input, unit);
        assert.deepEqual(second, first);
        assert.equal(first.classification, first.token.includes("/") ? "fraction" : "decimal");
        assert.deepEqual(parseExactToken(first, unit), input);
      }
    }
  }
});

test("invalid source-domain Rationals fail instead of emitting invalid Duration syntax", () => {
  assert.throws(
    () =>
      serializeExactDurationSource(
        { numerator: -1n, denominator: 2n },
        "day",
      ),
    /Duration Rational must not be negative/,
  );
  assert.throws(
    () =>
      serializeExactDurationSource(
        { numerator: 1n, denominator: 0n },
        "hour",
      ),
    /Rational denominator must not be zero/,
  );
  assert.deepEqual(
    serializeExactDurationSource(
      { numerator: -2n, denominator: -4n },
      "point",
    ),
    { classification: "decimal", token: "0.5p" },
  );
});
