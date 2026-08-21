import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalizeExactVelocitySourceToken,
  parseExactVelocitySourceToken,
  serializeCanonicalVelocitySourceToken,
} from "../dist/model/exact-velocity-source.js";

const cases = [
  ["2p/1h", "2p/1h", "2", "1", "hour"],
  ["0.5p/1h", "1p/2h", "1", "2", "hour"],
  ["1p/2h", "1p/2h", "1", "2", "hour"],
  ["7200/827p/1h", "7200p/827h", "7200", "827", "hour"],
  ["14400/1654p/1h", "7200p/827h", "7200", "827", "hour"],
  ["3/2p/5/4d", "6p/5d", "6", "5", "day"],
];

test("exact Velocity parsing and canonical display preserve one reduced rate", () => {
  for (const [source, canonical, numerator, denominator, unit] of cases) {
    const parsed = parseExactVelocitySourceToken(source);
    assert.notEqual(parsed, null, source);
    assert.equal(parsed.rate.numerator.toString(), numerator, source);
    assert.equal(parsed.rate.denominator.toString(), denominator, source);
    assert.equal(parsed.periodUnit, unit, source);
    assert.equal(
      serializeCanonicalVelocitySourceToken(parsed.rate, parsed.periodUnit),
      canonical,
      source,
    );
    assert.equal(canonicalizeExactVelocitySourceToken(source), canonical, source);
    const reparsed = parseExactVelocitySourceToken(canonical);
    assert.deepEqual(reparsed?.rate, parsed.rate, source);
  }
});

test("exact Velocity parsing rejects malformed and non-positive input", () => {
  for (const source of [
    "1/0p/1h",
    "1p/1/0h",
    "-1p/1h",
    "1p/-1h",
    "1p/1p",
    "1h/1d",
    "1p/1m",
    "1p//1h",
  ]) {
    assert.equal(parseExactVelocitySourceToken(source), null, source);
  }
  assert.notEqual(parseExactVelocitySourceToken("0p/1h"), null);
  assert.notEqual(parseExactVelocitySourceToken("1p/0h"), null);
  assert.equal(canonicalizeExactVelocitySourceToken("0p/1h"), null);
  assert.equal(canonicalizeExactVelocitySourceToken("1p/0h"), null);
  assert.equal(
    serializeCanonicalVelocitySourceToken({ numerator: 0n, denominator: 1n }, "hour"),
    null,
  );
});
