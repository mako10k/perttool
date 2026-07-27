import type { GovernanceRequestInput } from "../governance/types.js";
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
  TARGET_GOVERNANCE_COMMAND_REGISTRY,
  type TargetGovernanceCommandDescriptor,
} from "./target-governance-discovery.js";

const principalPattern = /^[A-Za-z][A-Za-z0-9_-]*$/;
const principalListPattern =
  /^\[[ \t]*(?:[A-Za-z][A-Za-z0-9_-]*(?:[ \t]*,[ \t]*[A-Za-z][A-Za-z0-9_-]*)*)?[ \t]*\]$/;
const projectGovernanceOptionNames = new Set([
  "goal-owner",
  "goal-delegates",
  "dag-owner",
  "dag-delegates",
]);

export interface TargetGovernanceValidCommandInvocation {
  readonly ok: true;
  readonly descriptor: TargetGovernanceCommandDescriptor;
  readonly helpAlias: boolean;
  readonly operands: readonly string[];
  readonly options: readonly CommandOptionOccurrence[];
}

export interface TargetGovernanceInvalidCommandInvocation {
  readonly ok: false;
  readonly error: CommandUsageError;
}

export type TargetGovernanceCommandInvocationValidation =
  | TargetGovernanceValidCommandInvocation
  | TargetGovernanceInvalidCommandInvocation;

function helpTarget(
  descriptor: TargetGovernanceCommandDescriptor,
): CommandHelpTarget {
  return descriptor.path.length === 1
    ? Object.freeze({
        resource: descriptor.path[0],
        action: null,
      })
    : Object.freeze({
        resource: descriptor.path[0],
        action: descriptor.path[1],
      });
}

function invalid(
  descriptor: TargetGovernanceCommandDescriptor,
  kind: CommandUsageError["kind"],
  message: string,
  token: string | null,
): TargetGovernanceInvalidCommandInvocation {
  return {
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
  };
}

function principalList(value: string): readonly string[] | null {
  if (!principalListPattern.test(value)) return null;
  const interior = value.slice(1, -1).trim();
  if (interior === "") return Object.freeze([]);
  const principals = interior.split(",").map((item) => item.trim());
  return new Set(principals).size === principals.length
    ? Object.freeze(principals)
    : null;
}

function validateGovernanceValues(
  invocation: TargetGovernanceValidCommandInvocation,
): TargetGovernanceCommandInvocationValidation {
  const optionByName = new Map(
    invocation.descriptor.options.map((option) => [
      option.name,
      option,
    ]),
  );
  const seenAcceptedOwners = new Set<string>();
  const occurrenceByName = new Map(
    invocation.options.map((occurrence) => [
      occurrence.name,
      occurrence,
    ]),
  );
  for (const occurrence of invocation.options) {
    const descriptor = optionByName.get(occurrence.name);
    if (descriptor === undefined || occurrence.value === null) continue;
    if (
      descriptor.valueType === "principal-id" &&
      !principalPattern.test(occurrence.value)
    ) {
      return invalid(
        invocation.descriptor,
        "invalid_option_value",
        `option --${occurrence.name} requires an ASCII principal ID`,
        occurrence.value,
      );
    }
    if (occurrence.name === "accepted-by-owner") {
      if (seenAcceptedOwners.has(occurrence.value)) {
        return invalid(
          invocation.descriptor,
          "duplicate_option",
          `option --accepted-by-owner repeats principal ${occurrence.value}`,
          occurrence.value,
        );
      }
      seenAcceptedOwners.add(occurrence.value);
    }
    if (
      descriptor.valueType === "principal-list" &&
      principalList(occurrence.value) === null
    ) {
      return invalid(
        invocation.descriptor,
        "invalid_option_value",
        `option --${occurrence.name} requires a duplicate-free bracketed principal list`,
        occurrence.value,
      );
    }
  }
  if (
    invocation.descriptor.operation === "project.init" &&
    invocation.options.some(({ name }) =>
      projectGovernanceOptionNames.has(name)
    )
  ) {
    const version = occurrenceByName.get("version");
    if (version !== undefined && version.value !== "4") {
      return invalid(
        invocation.descriptor,
        "option_conflict",
        "project init governance options conflict with an explicit version other than 4",
        version.value,
      );
    }
  }
  return invocation;
}

export function validateTargetGovernanceCommandInvocation(
  argv: readonly string[],
): TargetGovernanceCommandInvocationValidation {
  const validation = validateCommandInvocationAgainstRegistry(
    argv,
    TARGET_GOVERNANCE_COMMAND_REGISTRY as unknown as
      readonly ProjectedCommandDescriptor[],
  ) as CommandInvocationValidation;
  if (!validation.ok) return validation;
  return validateGovernanceValues({
    ...validation,
    descriptor:
      validation.descriptor as unknown as
        TargetGovernanceCommandDescriptor,
  });
}

export function governanceRequestFromTargetInvocation(
  invocation: TargetGovernanceValidCommandInvocation,
): GovernanceRequestInput {
  if (
    !invocation.descriptor.options.some(
      ({ sharedGroup }) => sharedGroup === "governance",
    )
  ) {
    throw new TypeError(
      `${invocation.descriptor.operation} has no governance assertion group`,
    );
  }
  const actor = invocation.options.find(
    ({ name }) => name === "actor",
  )?.value ?? null;
  const acceptedByOwner = invocation.options
    .filter(({ name }) => name === "accepted-by-owner")
    .map(({ value }) => value!);
  const persist = invocation.options.some(
    ({ name }) => name === "write" || name === "out",
  );
  return Object.freeze({
    intent: persist ? "persist" : "preview",
    actor,
    acceptedByOwner: Object.freeze(acceptedByOwner),
  });
}

export function targetGovernanceCommandUsageErrorToJson(
  error: CommandUsageError,
): Readonly<Record<string, unknown>> {
  return commandUsageErrorToJsonForContract(error, 5);
}

export function serializeTargetGovernanceCommandUsageError(
  error: CommandUsageError,
): string {
  return `${
    JSON.stringify(targetGovernanceCommandUsageErrorToJson(error), null, 2)
  }\n`;
}

export { renderCommandUsageError as renderTargetGovernanceCommandUsageError };
