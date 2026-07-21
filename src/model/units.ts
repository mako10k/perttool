import type { Rational } from "./rational.js";
import { divide, multiply } from "./rational.js";

export type CalendarUnit = "day" | "hour";
export type DurationUnit = CalendarUnit | "point";

export interface Velocity {
  readonly points: Rational;
  readonly period: Rational;
  readonly periodUnit: CalendarUnit;
}

export interface VelocityConversion {
  readonly qualifier: "velocity_forecast";
  readonly sourceUnit: DurationUnit;
  readonly targetUnit: DurationUnit;
  readonly targetPerSource: Rational;
}

export function durationSuffix(unit: DurationUnit): "d" | "h" | "p" {
  return unit === "day" ? "d" : unit === "hour" ? "h" : "p";
}

export function createVelocityConversion(
  sourceUnit: DurationUnit,
  velocity: Velocity | null,
): VelocityConversion | null {
  if (velocity === null) return null;
  if (sourceUnit === "point") {
    return {
      qualifier: "velocity_forecast",
      sourceUnit,
      targetUnit: velocity.periodUnit,
      targetPerSource: divide(velocity.period, velocity.points),
    };
  }
  if (sourceUnit !== velocity.periodUnit) {
    throw new Error("validated velocity period unit differs from project duration unit");
  }
  return {
    qualifier: "velocity_forecast",
    sourceUnit,
    targetUnit: "point",
    targetPerSource: divide(velocity.points, velocity.period),
  };
}

export function convertWithVelocity(
  value: Rational,
  conversion: VelocityConversion,
): Rational {
  return multiply(value, conversion.targetPerSource);
}
