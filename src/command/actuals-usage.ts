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
  ACTUALS_COMMAND_REGISTRY,
  type ActualsCommandDescriptor,
} from "./actuals-discovery.js";

const principalPattern = /^[A-Za-z][A-Za-z0-9_-]*$/;
const principalListPattern =
  /^\[[ \t]*(?:[A-Za-z][A-Za-z0-9_-]*(?:[ \t]*,[ \t]*[A-Za-z][A-Za-z0-9_-]*)*)?[ \t]*\]$/;
const projectGovernanceOptionNames = new Set([
  "goal-owner",
  "goal-delegates",
  "dag-owner",
  "dag-delegates",
]);

export interface ActualsValidCommandInvocation {
  readonly ok: true;
  readonly descriptor: ActualsCommandDescriptor;
  readonly helpAlias: boolean;
  readonly operands: readonly string[];
  readonly options: readonly CommandOptionOccurrence[];
}

export interface ActualsInvalidCommandInvocation {
  readonly ok: false;
  readonly error: CommandUsageError;
}

export type ActualsCommandInvocationValidation =
  | ActualsValidCommandInvocation
  | ActualsInvalidCommandInvocation;

function helpTarget(
  descriptor: ActualsCommandDescriptor,
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
  descriptor: ActualsCommandDescriptor,
  kind: CommandUsageError["kind"],
  message: string,
  token: string | null,
): ActualsInvalidCommandInvocation {
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

function validateValues(
  invocation: ActualsValidCommandInvocation,
): ActualsCommandInvocationValidation {
  const optionByName = new Map(
    invocation.descriptor.options.map((option) => [
      option.name,
      option,
    ]),
  );
  const occurrencesByName = new Map<string, CommandOptionOccurrence[]>();
  const seenAcceptedOwners = new Set<string>();
  for (const occurrence of invocation.options) {
    const entries = occurrencesByName.get(occurrence.name) ?? [];
    entries.push(occurrence);
    occurrencesByName.set(occurrence.name, entries);
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
    const version = occurrencesByName.get("version")?.[0];
    if (
      version !== undefined &&
      version.value !== "4" &&
      version.value !== "5"
    ) {
      return invalid(
        invocation.descriptor,
        "option_conflict",
        "project init governance options conflict with an explicit version other than 4 or 5",
        version.value,
      );
    }
  }
  const selectedTasks =
    occurrencesByName.get("task")?.map(({ value }) => value!) ?? [];
  if (new Set(selectedTasks).size !== selectedTasks.length) {
    return invalid(
      invocation.descriptor,
      "duplicate_option",
      "option --task repeats a task ID",
      selectedTasks.find(
        (value, index) => selectedTasks.indexOf(value) !== index,
      ) ?? null,
    );
  }
  return invocation;
}

export function validateActualsCommandInvocation(
  argv: readonly string[],
): ActualsCommandInvocationValidation {
  const validation = validateCommandInvocationAgainstRegistry(
    argv,
    ACTUALS_COMMAND_REGISTRY as unknown as
      readonly ProjectedCommandDescriptor[],
  ) as CommandInvocationValidation;
  if (!validation.ok) return validation;
  return validateValues({
    ...validation,
    descriptor:
      validation.descriptor as unknown as ActualsCommandDescriptor,
  });
}

export function governanceRequestFromActualsInvocation(
  invocation: ActualsValidCommandInvocation,
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

export function actualsCommandUsageErrorToJson(
  error: CommandUsageError,
): Readonly<Record<string, unknown>> {
  return commandUsageErrorToJsonForContract(error, 6);
}

export function serializeActualsCommandUsageError(
  error: CommandUsageError,
): string {
  return `${JSON.stringify(actualsCommandUsageErrorToJson(error), null, 2)}\n`;
}

export { renderCommandUsageError as renderActualsCommandUsageError };
