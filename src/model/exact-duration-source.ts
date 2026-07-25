import { rational } from "./rational.js";
import type { Rational } from "./rational.js";
import { durationSuffix } from "./units.js";
import type { DurationUnit } from "./units.js";

export type ExactDurationSourceClassification = "decimal" | "fraction";

export interface ExactDurationSourceToken {
  readonly classification: ExactDurationSourceClassification;
  readonly token: string;
}

const exactDurationTokenPattern =
  /^([0-9]+)(?:\.([0-9]+)|\/([0-9]+))?([dhp])$/;

function divideOut(
  value: bigint,
  factor: bigint,
): { readonly remainder: bigint; readonly exponent: number } {
  let remainder = value;
  let exponent = 0;
  while (remainder % factor === 0n) {
    remainder /= factor;
    exponent += 1;
  }
  return { remainder, exponent };
}

function exactTerminatingDecimal(value: Rational): string | null {
  const powersOfTwo = divideOut(value.denominator, 2n);
  const powersOfFive = divideOut(powersOfTwo.remainder, 5n);
  if (powersOfFive.remainder !== 1n) return null;

  const scale = Math.max(powersOfTwo.exponent, powersOfFive.exponent);
  if (scale === 0) return value.numerator.toString();

  const scaledNumerator =
    value.numerator *
    2n ** BigInt(scale - powersOfTwo.exponent) *
    5n ** BigInt(scale - powersOfFive.exponent);
  const digits = scaledNumerator.toString().padStart(scale + 1, "0");
  const whole = digits.slice(0, -scale);
  const fraction = digits.slice(-scale).replace(/0+$/, "");
  return fraction === "" ? whole : `${whole}.${fraction}`;
}

export function serializeExactDurationSource(
  value: Rational,
  unit: DurationUnit,
): ExactDurationSourceToken {
  const normalized = rational(value.numerator, value.denominator);
  if (normalized.numerator < 0n) {
    throw new Error("Duration Rational must not be negative");
  }

  const suffix = durationSuffix(unit);
  if (normalized.numerator === 0n) {
    return { classification: "decimal", token: `0${suffix}` };
  }

  const decimal = exactTerminatingDecimal(normalized);
  if (decimal !== null) {
    return { classification: "decimal", token: `${decimal}${suffix}` };
  }
  return {
    classification: "fraction",
    token: `${normalized.numerator}/${normalized.denominator}${suffix}`,
  };
}

export function canonicalizeExactDurationSourceToken(
  source: string,
): ExactDurationSourceToken | null {
  const match = exactDurationTokenPattern.exec(source);
  if (match === null) return null;
  const whole = match[1];
  const decimalFraction = match[2];
  const fractionDenominator = match[3];
  const suffix = match[4];
  if (
    whole === undefined ||
    (suffix !== "d" && suffix !== "h" && suffix !== "p")
  ) {
    return null;
  }
  const unit: DurationUnit =
    suffix === "d" ? "day" : suffix === "h" ? "hour" : "point";
  if (fractionDenominator !== undefined) {
    const denominator = BigInt(fractionDenominator);
    if (denominator === 0n) return null;
    return serializeExactDurationSource(
      rational(BigInt(whole), denominator),
      unit,
    );
  }
  const fraction = decimalFraction ?? "";
  return serializeExactDurationSource(
    rational(
      BigInt(`${whole}${fraction}`),
      10n ** BigInt(fraction.length),
    ),
    unit,
  );
}
