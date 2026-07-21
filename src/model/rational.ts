import type { DurationValue } from "./syntax.js";

export interface Rational {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

export function rational(numerator: bigint, denominator = 1n): Rational {
  if (denominator === 0n) throw new Error("Rational denominator must not be zero");
  if (numerator === 0n) return { numerator: 0n, denominator: 1n };
  const sign = denominator < 0n ? -1n : 1n;
  const divisor = gcd(numerator, denominator);
  return {
    numerator: (numerator / divisor) * sign,
    denominator: (denominator / divisor) * sign,
  };
}

export const ZERO = rational(0n);
export const ONE = rational(1n);

export function rationalFromDuration(value: DurationValue): Rational {
  return rational(value.digits, 10n ** BigInt(value.scale));
}

export function add(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

export function subtract(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.denominator - right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

export function multiply(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.numerator,
    left.denominator * right.denominator,
  );
}

export function divide(left: Rational, right: Rational): Rational {
  if (right.numerator === 0n) throw new Error("Rational division by zero");
  return rational(
    left.numerator * right.denominator,
    left.denominator * right.numerator,
  );
}

export function square(value: Rational): Rational {
  return multiply(value, value);
}

export function absolute(value: Rational): Rational {
  return value.numerator < 0n
    ? { numerator: -value.numerator, denominator: value.denominator }
    : value;
}

export function compare(left: Rational, right: Rational): number {
  const difference =
    left.numerator * right.denominator - right.numerator * left.denominator;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

export function minimum(left: Rational, right: Rational): Rational {
  return compare(left, right) <= 0 ? left : right;
}

export function maximum(left: Rational, right: Rational): Rational {
  return compare(left, right) >= 0 ? left : right;
}

export function isZero(value: Rational): boolean {
  return value.numerator === 0n;
}

export function formatDecimal(value: Rational, precision: number): string {
  if (!Number.isInteger(precision) || precision < 0) {
    throw new Error("precision must be a nonnegative integer");
  }
  const negative = value.numerator < 0n;
  const magnitude = negative ? -value.numerator : value.numerator;
  const scale = 10n ** BigInt(precision);
  const scaled = magnitude * scale;
  let rounded = scaled / value.denominator;
  const remainder = scaled % value.denominator;
  if (remainder * 2n >= value.denominator) rounded += 1n;
  if (rounded === 0n) return "0";
  if (precision === 0) return `${negative ? "-" : ""}${rounded.toString()}`;
  const raw = rounded.toString().padStart(precision + 1, "0");
  const whole = raw.slice(0, -precision);
  const fraction = raw.slice(-precision).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction === "" ? "" : `.${fraction}`}`;
}
