import { TOOL_VERSION } from "../version.js";
import { CONTRACT4_COMMAND_REGISTRY } from "./discovery.js";
import type { ProjectedCommandDescriptor } from "./registry.js";

export type CommandUsageErrorKind =
  | "missing_resource"
  | "unknown_resource"
  | "missing_action"
  | "unknown_action"
  | "unknown_option"
  | "missing_option_value"
  | "unexpected_option_value"
  | "duplicate_option"
  | "invalid_option_value"
  | "missing_operand"
  | "extra_operand"
  | "missing_required_option"
  | "option_conflict"
  | "option_requires";

export type CommandUsageSuggestionKind =
  | "resource"
  | "action"
  | "option";

export interface CommandHelpTarget {
  readonly resource: string | null;
  readonly action: string | null;
}

export interface CommandUsageSuggestion {
  readonly kind: CommandUsageSuggestionKind;
  readonly value: string;
}

export interface CommandUsageError {
  readonly code: "PTCLI-001";
  readonly kind: CommandUsageErrorKind;
  readonly message: string;
  readonly operation: string | null;
  readonly token: string | null;
  readonly helpTarget: CommandHelpTarget;
  readonly suggestion: CommandUsageSuggestion | null;
}

export interface CommandOptionOccurrence {
  readonly name: string;
  readonly value: string | null;
}

export interface ValidCommandInvocation {
  readonly ok: true;
  readonly descriptor: ProjectedCommandDescriptor;
  readonly helpAlias: boolean;
  readonly operands: readonly string[];
  readonly options: readonly CommandOptionOccurrence[];
}

export interface InvalidCommandInvocation {
  readonly ok: false;
  readonly error: CommandUsageError;
}

export type CommandInvocationValidation =
  | ValidCommandInvocation
  | InvalidCommandInvocation;

interface IndexedOptionOccurrence extends CommandOptionOccurrence {
  readonly index: number;
  readonly token: string;
}

interface IndexedOperand {
  readonly index: number;
  readonly value: string;
}

const topLevelByName = new Map<string, ProjectedCommandDescriptor>();
const commandsByPath = new Map<string, ProjectedCommandDescriptor>();
const resourceActions = new Map<string, string[]>();
const resources: string[] = [];

for (const descriptor of CONTRACT4_COMMAND_REGISTRY) {
  if (descriptor.path.length === 1) {
    topLevelByName.set(descriptor.path[0], descriptor);
    continue;
  }
  const [resource, action] = descriptor.path;
  commandsByPath.set(`${resource}\0${action}`, descriptor);
  const actions = resourceActions.get(resource);
  if (actions === undefined) {
    resources.push(resource);
    resourceActions.set(resource, [action]);
  } else {
    actions.push(action);
  }
}

function helpTarget(
  descriptor: ProjectedCommandDescriptor,
): CommandHelpTarget {
  return descriptor.path.length === 1
    ? Object.freeze({ resource: descriptor.path[0], action: null })
    : Object.freeze({
        resource: descriptor.path[0],
        action: descriptor.path[1],
      });
}

function usageError(
  kind: CommandUsageErrorKind,
  message: string,
  token: string | null,
  target: CommandHelpTarget,
  operation: string | null,
  suggestion: CommandUsageSuggestion | null = null,
): InvalidCommandInvocation {
  return {
    ok: false,
    error: Object.freeze({
      code: "PTCLI-001",
      kind,
      message,
      operation,
      token,
      helpTarget: target,
      suggestion,
    }),
  };
}

function restrictedDamerauLevenshtein(
  left: string,
  right: string,
): number {
  const rows = Array.from(
    { length: left.length + 1 },
    () => Array<number>(right.length + 1).fill(0),
  );
  for (let leftIndex = 0; leftIndex <= left.length; leftIndex += 1) {
    rows[leftIndex]![0] = leftIndex;
  }
  for (let rightIndex = 0; rightIndex <= right.length; rightIndex += 1) {
    rows[0]![rightIndex] = rightIndex;
  }
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution =
        left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      let distance = Math.min(
        rows[leftIndex - 1]![rightIndex]! + 1,
        rows[leftIndex]![rightIndex - 1]! + 1,
        rows[leftIndex - 1]![rightIndex - 1]! + substitution,
      );
      if (
        leftIndex > 1 &&
        rightIndex > 1 &&
        left[leftIndex - 1] === right[rightIndex - 2] &&
        left[leftIndex - 2] === right[rightIndex - 1]
      ) {
        distance = Math.min(
          distance,
          rows[leftIndex - 2]![rightIndex - 2]! + 1,
        );
      }
      rows[leftIndex]![rightIndex] = distance;
    }
  }
  return rows[left.length]![right.length]!;
}

function nearestSuggestion(
  value: string,
  candidates: readonly string[],
  kind: CommandUsageSuggestionKind,
): CommandUsageSuggestion | null {
  let best: string | null = null;
  let bestDistance = Number.MAX_SAFE_INTEGER;
  for (const candidate of candidates) {
    const distance = restrictedDamerauLevenshtein(value, candidate);
    const limit = Math.max(
      1,
      Math.floor(Math.max(value.length, candidate.length) / 3),
    );
    if (distance <= limit && distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best === null ? null : Object.freeze({ kind, value: best });
}

function optionName(token: string): string {
  const equals = token.indexOf("=");
  return equals === -1 ? token.slice(2) : token.slice(2, equals);
}

function optionValue(
  occurrence: IndexedOptionOccurrence | undefined,
): string | null {
  return occurrence?.value ?? null;
}

function conditionalConflict(
  expression: string,
  occurrences: ReadonlyMap<string, IndexedOptionOccurrence>,
): readonly IndexedOptionOccurrence[] | null {
  const matched = expression.match(
    /^([a-z][a-z0-9-]*)=([^ ]+) when ([a-z][a-z0-9-]*)=([^ ]+)$/,
  );
  if (matched === null) return null;
  const [, leftName, leftValue, rightName, rightValue] = matched;
  const left = occurrences.get(leftName!);
  const right = occurrences.get(rightName!);
  return optionValue(left) === leftValue && optionValue(right) === rightValue
    ? [left!, right!]
    : [];
}

function requirementSatisfied(
  requirement: string,
  occurrences: ReadonlyMap<string, IndexedOptionOccurrence>,
): boolean {
  const conditional = requirement.match(
    /^([a-z][a-z0-9-]*)=([a-z0-9-]+(?:\|[a-z0-9-]+)*)$/,
  );
  if (conditional === null) return occurrences.has(requirement);
  const occurrence = occurrences.get(conditional[1]!);
  return (
    occurrence !== undefined &&
    occurrence.value !== null &&
    conditional[2]!.split("|").includes(occurrence.value)
  );
}

function validateDescriptorArguments(
  descriptor: ProjectedCommandDescriptor,
  args: readonly string[],
): CommandInvocationValidation {
  if (args.length === 1 && args[0] === "--help") {
    return {
      ok: true,
      descriptor,
      helpAlias: true,
      operands: Object.freeze([]),
      options: Object.freeze([]),
    };
  }

  const optionByName = new Map(
    descriptor.options.map((option) => [option.name, option]),
  );
  const occurrences = new Map<string, IndexedOptionOccurrence>();
  const orderedOccurrences: IndexedOptionOccurrence[] = [];
  const operands: IndexedOperand[] = [];
  let optionsEnded = false;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]!;
    if (!optionsEnded && token === "--") {
      optionsEnded = true;
      continue;
    }
    if (optionsEnded || !token.startsWith("--")) {
      operands.push({ index, value: token });
      continue;
    }

    const name = optionName(token);
    const option = optionByName.get(name);
    if (option === undefined) {
      return usageError(
        "unknown_option",
        `unknown option --${name}`,
        token,
        helpTarget(descriptor),
        descriptor.operation,
        nearestSuggestion(name, [...optionByName.keys()], "option"),
      );
    }
    if (occurrences.has(name) && !option.repeatable) {
      return usageError(
        "duplicate_option",
        `option --${name} is not repeatable`,
        token,
        helpTarget(descriptor),
        descriptor.operation,
      );
    }

    const equals = token.indexOf("=");
    let value: string | null = null;
    if (option.kind === "flag") {
      if (equals !== -1) {
        return usageError(
          "unexpected_option_value",
          `boolean option --${name} does not take a value`,
          token,
          helpTarget(descriptor),
          descriptor.operation,
        );
      }
    } else if (equals === -1) {
      const following = args[index + 1];
      if (following === undefined || following.startsWith("--")) {
        return usageError(
          "missing_option_value",
          `option --${name} requires a value`,
          token,
          helpTarget(descriptor),
          descriptor.operation,
        );
      }
      value = following;
      index += 1;
    } else {
      value = token.slice(equals + 1);
    }

    if (
      value !== null &&
      option.enumValues.length > 0 &&
      !option.enumValues.includes(value)
    ) {
      return usageError(
        "invalid_option_value",
        `option --${name} must be one of ${option.enumValues.join(", ")}`,
        value,
        helpTarget(descriptor),
        descriptor.operation,
      );
    }

    const occurrence = Object.freeze({ name, value, index, token });
    occurrences.set(name, occurrence);
    orderedOccurrences.push(occurrence);
  }

  const maximumOperands = descriptor.operands.length;
  if (operands.length > maximumOperands) {
    const extra = operands[maximumOperands]!;
    return usageError(
      "extra_operand",
      `${descriptor.path.join(" ")} accepts at most ${maximumOperands} operand${maximumOperands === 1 ? "" : "s"}`,
      extra.value,
      helpTarget(descriptor),
      descriptor.operation,
    );
  }
  const missingOperand = descriptor.operands.find(
    (operand) => operand.required && operands[operand.position] === undefined,
  );
  if (missingOperand !== undefined) {
    return usageError(
      "missing_operand",
      `${descriptor.path.join(" ")} requires operand <${missingOperand.name}>`,
      null,
      helpTarget(descriptor),
      descriptor.operation,
    );
  }
  const missingOption = descriptor.options.find(
    (option) => option.required && !occurrences.has(option.name),
  );
  if (missingOption !== undefined) {
    return usageError(
      "missing_required_option",
      `${descriptor.path.join(" ")} requires option --${missingOption.name}`,
      `--${missingOption.name}`,
      helpTarget(descriptor),
      descriptor.operation,
    );
  }

  for (const occurrence of orderedOccurrences) {
    const option = optionByName.get(occurrence.name)!;
    for (const conflict of option.conflicts) {
      if (conflict === "stdin") {
        if (operands[0]?.value === "-") {
          return usageError(
            "option_conflict",
            `option --${option.name} conflicts with document stdin`,
            occurrence.token,
            helpTarget(descriptor),
            descriptor.operation,
          );
        }
        continue;
      }
      if (/^[a-z][a-z0-9-]*$/.test(conflict)) {
        const other = occurrences.get(conflict);
        if (other !== undefined) {
          const later =
            other.index > occurrence.index ? other : occurrence;
          return usageError(
            "option_conflict",
            `option --${option.name} conflicts with --${conflict}`,
            later.token,
            helpTarget(descriptor),
            descriptor.operation,
          );
        }
        continue;
      }
      const conditional = conditionalConflict(conflict, occurrences);
      if (conditional !== null && conditional.length > 0) {
        const later = [...conditional].sort(
          (left, right) => right.index - left.index,
        )[0]!;
        return usageError(
          "option_conflict",
          `options violate conflict ${conflict}`,
          later.token,
          helpTarget(descriptor),
          descriptor.operation,
        );
      }
    }
  }

  if (
    descriptor.stdin.mutuallyExclusive &&
    operands[0]?.value === "-" &&
    orderedOccurrences.some(
      (occurrence) =>
        occurrence.value === "-" &&
        descriptor.options.find(({ name }) => name === occurrence.name)
          ?.valueType?.endsWith("path-or-stdin") === true,
    )
  ) {
    const request = orderedOccurrences.find(
      (occurrence) =>
        occurrence.value === "-" &&
        optionByName
          .get(occurrence.name)
          ?.valueType?.endsWith("path-or-stdin") === true,
    )!;
    return usageError(
      "option_conflict",
      "document and request stdin are mutually exclusive",
      request.token,
      helpTarget(descriptor),
      descriptor.operation,
    );
  }

  for (const occurrence of orderedOccurrences) {
    const option = optionByName.get(occurrence.name)!;
    const missingRequirement = option.requires.find(
      (requirement) => !requirementSatisfied(requirement, occurrences),
    );
    if (missingRequirement !== undefined) {
      return usageError(
        "option_requires",
        `option --${option.name} requires --${missingRequirement}`,
        occurrence.token,
        helpTarget(descriptor),
        descriptor.operation,
      );
    }
  }

  return {
    ok: true,
    descriptor,
    helpAlias: false,
    operands: Object.freeze(operands.map(({ value }) => value)),
    options: Object.freeze(
      orderedOccurrences.map(({ name, value }) => Object.freeze({ name, value })),
    ),
  };
}

export function validateCommandInvocation(
  argv: readonly string[],
): CommandInvocationValidation {
  if (argv.length === 0) {
    return usageError(
      "missing_resource",
      "expected a command resource",
      null,
      Object.freeze({ resource: null, action: null }),
      null,
    );
  }

  const resource = argv[0]!;
  const topLevel = topLevelByName.get(resource);
  if (topLevel !== undefined) {
    return validateDescriptorArguments(topLevel, argv.slice(1));
  }
  const actions = resourceActions.get(resource);
  if (actions === undefined) {
    return usageError(
      "unknown_resource",
      `unknown command resource: ${resource}`,
      resource,
      Object.freeze({ resource: null, action: null }),
      null,
      nearestSuggestion(resource, resources, "resource"),
    );
  }
  if (argv.length < 2 || argv[1]!.startsWith("--")) {
    return usageError(
      "missing_action",
      `command resource ${resource} requires an action`,
      argv[1] ?? null,
      Object.freeze({ resource, action: null }),
      null,
    );
  }

  const action = argv[1]!;
  const descriptor = commandsByPath.get(`${resource}\0${action}`);
  if (descriptor === undefined) {
    return usageError(
      "unknown_action",
      `unknown action ${action} for command resource ${resource}`,
      action,
      Object.freeze({ resource, action: null }),
      null,
      nearestSuggestion(action, actions, "action"),
    );
  }
  return validateDescriptorArguments(descriptor, argv.slice(2));
}

function helpInvocation(target: CommandHelpTarget): string {
  return [
    "perttool",
    "help",
    ...(target.resource === null ? [] : [target.resource]),
    ...(target.action === null ? [] : [target.action]),
  ].join(" ");
}

function renderedSuggestion(
  suggestion: CommandUsageSuggestion,
): string {
  return suggestion.kind === "option"
    ? `--${suggestion.value}`
    : suggestion.value;
}

export function commandUsageErrorToJson(
  error: CommandUsageError,
): Readonly<Record<string, unknown>> {
  return {
    schema_version: "Perttool.CliError.v1",
    cli_contract_version: 4,
    tool_version: TOOL_VERSION,
    operation: error.operation,
    ok: false,
    help_target: {
      resource: error.helpTarget.resource,
      action: error.helpTarget.action,
    },
    usage: {
      kind: error.kind,
      token: error.token,
      suggestion:
        error.suggestion === null
          ? null
          : {
              kind: error.suggestion.kind,
              value: error.suggestion.value,
            },
    },
    diagnostics: [
      {
        code: error.code,
        severity: "error",
        message: error.message,
        entity_id: null,
        span: null,
        related: [],
        help_topic: null,
        expected_syntax: null,
        fixes: [],
        data: {
          usage_kind: error.kind,
          token: error.token,
          suggestion:
            error.suggestion === null
              ? null
              : {
                  kind: error.suggestion.kind,
                  value: error.suggestion.value,
                },
        },
      },
    ],
  };
}

export function handlerCommandUsageError(
  descriptor: ProjectedCommandDescriptor,
  message: string,
): CommandUsageError {
  return Object.freeze({
    code: "PTCLI-001",
    kind: "invalid_option_value",
    message,
    operation: descriptor.operation,
    token: null,
    helpTarget: helpTarget(descriptor),
    suggestion: null,
  });
}

export function serializeCommandUsageError(
  error: CommandUsageError,
): string {
  return `${JSON.stringify(commandUsageErrorToJson(error), null, 2)}\n`;
}

export function renderCommandUsageError(
  error: CommandUsageError,
): string {
  return `${[
    `${error.code} error: ${error.message}`,
    ...(error.token === null ? [] : [`  token: ${error.token}`]),
    ...(error.suggestion === null
      ? []
      : [`  suggestion: ${renderedSuggestion(error.suggestion)}`]),
    `  help: ${helpInvocation(error.helpTarget)}`,
  ].join("\n")}\n`;
}
