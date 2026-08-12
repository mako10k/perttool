import type {
  CommandHelpTarget,
  CommandInvocationValidation,
  CommandOptionOccurrence,
  CommandUsageError,
} from "./usage.js";
import {
  commandUsageErrorToJsonForContract,
  renderCommandUsageError,
  validateCommandInvocationAgainstRegistry,
} from "./usage.js";
import type { ProjectedCommandDescriptor } from "./registry.js";
import {
  ASSURANCE_COMMAND_REGISTRY,
  type AssuranceCommandDescriptor,
} from "./assurance-discovery.js";

export interface AssuranceValidCommandInvocation {
  readonly ok: true;
  readonly descriptor: AssuranceCommandDescriptor;
  readonly helpAlias: boolean;
  readonly operands: readonly string[];
  readonly options: readonly CommandOptionOccurrence[];
}

export interface AssuranceInvalidCommandInvocation {
  readonly ok: false;
  readonly error: CommandUsageError;
}

export type AssuranceCommandInvocationValidation =
  | AssuranceValidCommandInvocation
  | AssuranceInvalidCommandInvocation;

const principalPattern = /^[A-Za-z][A-Za-z0-9_-]*$/;

function helpTarget(
  descriptor: AssuranceCommandDescriptor,
): CommandHelpTarget {
  return descriptor.path.length === 1
    ? Object.freeze({ resource: descriptor.path[0], action: null })
    : Object.freeze({ resource: descriptor.path[0], action: descriptor.path.slice(1).join(" ") });
}

function invalid(
  descriptor: AssuranceCommandDescriptor,
  kind: CommandUsageError["kind"],
  message: string,
  token: string | null,
): AssuranceInvalidCommandInvocation {
  return Object.freeze({
    ok: false,
    error: Object.freeze({
      code: "PTCLI-001",
      kind,
      message,
      operation: descriptor.operation,
      token,
      helpTarget: helpTarget(descriptor),
      suggestion: null,
    }),
  });
}

function validateValues(
  invocation: AssuranceValidCommandInvocation,
): AssuranceCommandInvocationValidation {
  const descriptors = new Map(invocation.descriptor.options.map((option) => [
    option.name,
    option,
  ]));
  const repeated = new Map<string, string[]>();
  for (const occurrence of invocation.options) {
    if (occurrence.value === null) continue;
    const option = descriptors.get(occurrence.name);
    if (
      option?.valueType === "principal-id" &&
      !principalPattern.test(occurrence.value)
    ) {
      return invalid(
        invocation.descriptor,
        "invalid_option_value",
        `option --${occurrence.name} requires an ASCII principal ID`,
        occurrence.value,
      );
    }
    const values = repeated.get(occurrence.name) ?? [];
    values.push(occurrence.value);
    repeated.set(occurrence.name, values);
  }
  for (const option of ["accepted-by-owner", "task"] as const) {
    const values = repeated.get(option) ?? [];
    const duplicate = values.find((value, index) => values.indexOf(value) !== index);
    if (duplicate !== undefined) {
      return invalid(
        invocation.descriptor,
        "duplicate_option",
        `option --${option} repeats ${duplicate}`,
        duplicate,
      );
    }
  }
  if (invocation.descriptor.operation === "dag.history") {
    const snapshot = repeated.get("snapshot")?.[0];
    const view = repeated.get("view")?.[0] ?? "lineage";
    if (snapshot !== undefined && view !== "snapshot") {
      return invalid(
        invocation.descriptor,
        "option_conflict",
        "option --snapshot requires --view snapshot",
        snapshot,
      );
    }
    if (
      snapshot !== undefined &&
      !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(snapshot)
    ) {
      return invalid(
        invocation.descriptor,
        "invalid_option_value",
        "option --snapshot requires a lower-case full Git object ID",
        snapshot,
      );
    }
  }
  return invocation;
}

export function validateAssuranceCommandInvocation(
  argv: readonly string[],
): AssuranceCommandInvocationValidation {
  const validation = validateCommandInvocationAgainstRegistry(
    argv,
    ASSURANCE_COMMAND_REGISTRY as unknown as readonly ProjectedCommandDescriptor[],
  ) as CommandInvocationValidation;
  if (!validation.ok) return validation;
  return validateValues({
    ...validation,
    descriptor: validation.descriptor as unknown as AssuranceCommandDescriptor,
  });
}

export function assuranceCommandUsageErrorToJson(
  error: CommandUsageError,
): Readonly<Record<string, unknown>> {
  return commandUsageErrorToJsonForContract(error, 8);
}

export function serializeAssuranceCommandUsageError(
  error: CommandUsageError,
): string {
  return `${JSON.stringify(assuranceCommandUsageErrorToJson(error), null, 2)}\n`;
}

export { renderCommandUsageError as renderAssuranceCommandUsageError };
