import type {
  Diagnostic,
  RelatedLocation,
  SourceSpan,
} from "../model/diagnostics.js";
import {
  compareStableStrings,
  hasErrors,
  sortDiagnostics,
} from "../model/diagnostics.js";
import type {
  DeclarationNode,
  DocumentNode,
  ExactDurationValue,
  FieldNode,
  RequirementValue,
  VelocityValue,
} from "../model/syntax.js";
import {
  compareDurations,
  fieldNamed,
  fieldsNamed,
  isZeroDuration,
} from "../model/syntax.js";

const reservedWords = new Set([
  "project",
  "resource",
  "milestone",
  "task",
  "gate",
  "version",
  "title",
  "description",
  "as_of",
  "duration_unit",
  "velocity",
  "finish",
  "critical_epsilon",
  "target_duration",
  "state",
  "tags",
  "duration",
  "estimate",
  "optimistic",
  "most_likely",
  "pessimistic",
  "status",
  "priority",
  "owner",
  "blocked_reason",
  "source",
  "reason",
  "capacity",
  "requires",
  "planned",
  "reached",
  "active",
  "blocked",
  "done",
  "day",
  "hour",
  "point",
]);

interface Edge {
  readonly declaration: DeclarationNode;
  readonly id: string;
  readonly source: string;
  readonly target: string;
}

interface ValidationProfile {
  readonly supportedGrammarVersions: ReadonlySet<number>;
  readonly unsupportedVersionMessage: string;
  readonly temporalAnchorGrammarVersions: ReadonlySet<number>;
}

const grammar1ValidationProfile: ValidationProfile = {
  supportedGrammarVersions: new Set([1]),
  unsupportedVersionMessage: "Only grammar version 1 is supported",
  temporalAnchorGrammarVersions: new Set(),
};

const targetValidationProfile: ValidationProfile = {
  supportedGrammarVersions: new Set([1, 2]),
  unsupportedVersionMessage: "Only grammar versions 1 and 2 are supported",
  temporalAnchorGrammarVersions: new Set([2]),
};

const targetGrammar3ValidationProfile: ValidationProfile = {
  supportedGrammarVersions: new Set([1, 2, 3]),
  unsupportedVersionMessage: "Only grammar versions 1, 2, and 3 are supported",
  temporalAnchorGrammarVersions: new Set([2, 3]),
};

function makeDiagnostic(
  code: string,
  severity: "error" | "warning",
  message: string,
  diagnosticSpan: SourceSpan,
  helpTopic: string,
  entityId?: string,
  related?: readonly RelatedLocation[],
): Diagnostic {
  return {
    code,
    severity,
    message,
    span: diagnosticSpan,
    helpTopic,
    ...(entityId === undefined ? {} : { entityId }),
    ...(related === undefined || related.length === 0 ? {} : { related }),
  };
}

function zeroSpan(document: DocumentNode): SourceSpan {
  return {
    start: { offset: 0, line: 0, column: 0 },
    end: { offset: document.text.length === 0 ? 0 : 1, line: 0, column: document.text.length === 0 ? 0 : 1 },
  };
}

function requireField(
  declaration: DeclarationNode,
  fieldName: string,
  diagnostics: Diagnostic[],
): FieldNode | undefined {
  const fields = fieldsNamed(declaration, fieldName);
  if (fields.length === 0) {
    diagnostics.push(
      makeDiagnostic(
        "PTSEM-101",
        "error",
        `${declaration.kind} ${declaration.id} is missing required field ${fieldName}`,
        declaration.idSpan,
        `syntax.${declaration.kind}`,
        declaration.id,
      ),
    );
    return undefined;
  }
  return fields[0];
}

function validateDuplicateFields(
  declaration: DeclarationNode,
  diagnostics: Diagnostic[],
): void {
  const firstByName = new Map<string, FieldNode>();
  for (const field of declaration.fields) {
    const first = firstByName.get(field.name);
    if (first === undefined) {
      firstByName.set(field.name, field);
      continue;
    }
    diagnostics.push(
      makeDiagnostic(
        "PTSEM-102",
        "error",
        `Field ${field.name} is duplicated in ${declaration.kind} ${declaration.id}`,
        field.span,
        `syntax.${declaration.kind}`,
        declaration.id,
        [{ message: "First field", span: first.span }],
      ),
    );
  }
}

function durationValue(
  field: FieldNode | undefined,
): ExactDurationValue | undefined {
  if (field === undefined || typeof field.value !== "object" || field.value === null) {
    return undefined;
  }
  if (!("suffix" in field.value)) return undefined;
  return (
    ("digits" in field.value && "scale" in field.value) ||
    ("numerator" in field.value && "denominator" in field.value)
  )
    ? (field.value as ExactDurationValue)
    : undefined;
}

function velocityValue(field: FieldNode | undefined): VelocityValue | undefined {
  if (field === undefined || typeof field.value !== "object" || field.value === null) {
    return undefined;
  }
  return "points" in field.value && "period" in field.value
    ? (field.value as VelocityValue)
    : undefined;
}

function validateNonemptyText(
  declaration: DeclarationNode,
  fieldName: string,
  diagnostics: Diagnostic[],
): void {
  const field = fieldNamed(declaration, fieldName);
  if (field !== undefined && typeof field.value === "string" && field.value.length === 0) {
    diagnostics.push(
      makeDiagnostic(
        "PTSEM-106",
        "error",
        `${fieldName} must not be empty`,
        field.valueSpan,
        `syntax.${declaration.kind}`,
        declaration.id,
      ),
    );
  }
}

function validateTags(
  declaration: DeclarationNode,
  diagnostics: Diagnostic[],
): void {
  const field = fieldNamed(declaration, "tags");
  if (field === undefined || !Array.isArray(field.value)) return;
  const seen = new Set<string>();
  for (const tag of field.value) {
    if (typeof tag !== "string") continue;
    if (seen.has(tag)) {
      diagnostics.push(
        makeDiagnostic(
          "PTSEM-107",
          "error",
          `Tag ${tag} is duplicated`,
          field.valueSpan,
          "syntax.tags",
          declaration.id,
        ),
      );
      return;
    }
    seen.add(tag);
  }
}

function isValidIsoDate(raw: string): boolean {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (dateMatch !== null) {
    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(raw) &&
    !Number.isNaN(Date.parse(raw))
  );
}

function validateFieldConstraints(
  document: DocumentNode,
  diagnostics: Diagnostic[],
  profile: ValidationProfile,
): void {
  const projects = document.declarations.filter((declaration) => declaration.kind === "project");
  if (projects.length === 0) {
    diagnostics.push(
      makeDiagnostic(
        "PTSEM-101",
        "error",
        "Missing project declaration",
        zeroSpan(document),
        "syntax.project",
      ),
    );
  }
  if (projects.length > 1) {
    const first = projects[0]!;
    for (const project of projects.slice(1)) {
      diagnostics.push(
        makeDiagnostic(
          "PTSEM-201",
          "error",
          "There must be exactly one project declaration",
          project.idSpan,
          "syntax.project",
          project.id,
          [{ message: "First project", span: first.idSpan }],
        ),
      );
    }
  }
  const firstDeclaration = document.declarations[0];
  if (firstDeclaration !== undefined && firstDeclaration.kind !== "project") {
    diagnostics.push(
      makeDiagnostic(
        "PTDSL-003",
        "error",
        "The project must be the first declaration",
        firstDeclaration.idSpan,
        "syntax.top-level",
        firstDeclaration.id,
      ),
    );
  }

  for (const declaration of document.declarations) {
    validateDuplicateFields(declaration, diagnostics);
    validateTags(declaration, diagnostics);
    validateNonemptyText(declaration, "title", diagnostics);
    validateNonemptyText(declaration, "description", diagnostics);
    if (declaration.kind === "project") {
      const title = requireField(declaration, "title", diagnostics);
      const durationUnit = requireField(declaration, "duration_unit", diagnostics);
      const velocityField = fieldNamed(declaration, "velocity");
      const velocity = velocityValue(velocityField);
      requireField(declaration, "finish", diagnostics);
      const version = fieldNamed(declaration, "version");
      if (
        version !== undefined &&
        typeof version.value === "number" &&
        !profile.supportedGrammarVersions.has(version.value)
      ) {
        diagnostics.push(
          makeDiagnostic(
            "PTSEM-108",
            "error",
            profile.unsupportedVersionMessage,
            version.valueSpan,
            "syntax.project",
            declaration.id,
          ),
        );
      }
      const asOf = fieldNamed(declaration, "as_of");
      if (asOf !== undefined && typeof asOf.value === "string" && !isValidIsoDate(asOf.value)) {
        diagnostics.push(
          makeDiagnostic(
            "PTDSL-008",
            "error",
            "as_of is not a valid ISO date or date-time",
            asOf.valueSpan,
            "syntax.project",
            declaration.id,
          ),
        );
      }
      const criticalEpsilon = durationValue(fieldNamed(declaration, "critical_epsilon"));
      const targetDuration = durationValue(fieldNamed(declaration, "target_duration"));
      if (targetDuration !== undefined && isZeroDuration(targetDuration)) {
        diagnostics.push(
          makeDiagnostic(
            "PTSEM-104",
            "error",
            "target_duration must be greater than 0",
            fieldNamed(declaration, "target_duration")!.valueSpan,
            "syntax.duration",
            declaration.id,
          ),
        );
      }
      void title;
      void criticalEpsilon;
      if (
        durationUnit !== undefined &&
        (durationUnit.value === "day" ||
          durationUnit.value === "hour" ||
          durationUnit.value === "point")
      ) {
        const expectedSuffix =
          durationUnit.value === "day" ? "d" : durationUnit.value === "hour" ? "h" : "p";
        for (const candidate of document.declarations) {
          for (const field of candidate.fields) {
            const values = field.children ?? [field];
            for (const valueField of values) {
              const value = durationValue(valueField);
              if (value !== undefined && value.suffix !== expectedSuffix) {
                diagnostics.push(
                  makeDiagnostic(
                    "PTSEM-105",
                    "error",
                    `Duration suffix does not match project unit ${durationUnit.value}`,
                    valueField.valueSpan,
                    "syntax.duration",
                    candidate.id,
                  ),
                );
              }
            }
          }
        }
        if (durationUnit.value === "point" && velocityField === undefined) {
          diagnostics.push(
            makeDiagnostic(
              "PTSEM-111",
              "error",
              "duration_unit point requires velocity",
              durationUnit.valueSpan,
              "syntax.velocity",
              declaration.id,
            ),
          );
        }
        if (velocity !== undefined) {
          if (isZeroDuration(velocity.points) || isZeroDuration(velocity.period)) {
            diagnostics.push(
              makeDiagnostic(
                "PTSEM-111",
                "error",
                "Velocity point and period values must be greater than 0",
                velocityField!.valueSpan,
                "syntax.velocity",
                declaration.id,
              ),
            );
          }
          if (
            durationUnit.value !== "point" &&
            velocity.period.suffix !== expectedSuffix
          ) {
            diagnostics.push(
              makeDiagnostic(
                "PTSEM-111",
                "error",
                `Velocity period suffix does not match project unit ${durationUnit.value}`,
                velocityField!.valueSpan,
                "syntax.velocity",
                declaration.id,
              ),
            );
          }
        }
      }
    }
    if (declaration.kind === "resource") {
      requireField(declaration, "title", diagnostics);
      const capacity = requireField(declaration, "capacity", diagnostics);
      if (capacity !== undefined && typeof capacity.value === "number" && capacity.value < 1) {
        diagnostics.push(
          makeDiagnostic(
            "PTSEM-109",
            "error",
            "Resource capacity must be at least 1",
            capacity.valueSpan,
            "syntax.resource",
            declaration.id,
          ),
        );
      }
    }
    if (declaration.kind === "milestone") {
      requireField(declaration, "title", diagnostics);
    }
    if (declaration.kind === "task") {
      requireField(declaration, "title", diagnostics);
      const durations = fieldsNamed(declaration, "duration");
      const estimates = fieldsNamed(declaration, "estimate");
      if (durations.length + estimates.length !== 1) {
        diagnostics.push(
          makeDiagnostic(
            "PTSEM-103",
            "error",
            "A task must have exactly one of duration or estimate",
            declaration.idSpan,
            "syntax.task",
            declaration.id,
          ),
        );
      }
      const duration = durationValue(durations[0]);
      if (duration !== undefined && isZeroDuration(duration)) {
        diagnostics.push(
          makeDiagnostic(
            "PTSEM-104",
            "error",
            "Task duration must be greater than 0",
            durations[0]!.valueSpan,
            "syntax.duration",
            declaration.id,
          ),
        );
      }
      const estimate = estimates[0];
      if (estimate !== undefined) {
        const children = estimate.children ?? [];
        for (const name of ["optimistic", "most_likely", "pessimistic"]) {
          const matching = children.filter((child) => child.name === name);
          if (matching.length !== 1) {
            diagnostics.push(
              makeDiagnostic(
                matching.length === 0 ? "PTSEM-101" : "PTSEM-102",
                "error",
                `Estimate requires exactly one ${name} value`,
                estimate.span,
                "syntax.estimate",
                declaration.id,
              ),
            );
          }
        }
        const optimistic = durationValue(children.find((child) => child.name === "optimistic"));
        const mostLikely = durationValue(children.find((child) => child.name === "most_likely"));
        const pessimistic = durationValue(children.find((child) => child.name === "pessimistic"));
        if (
          optimistic !== undefined &&
          mostLikely !== undefined &&
          pessimistic !== undefined &&
          (compareDurations(optimistic, mostLikely) > 0 ||
            compareDurations(mostLikely, pessimistic) > 0 ||
            isZeroDuration(pessimistic))
        ) {
          diagnostics.push(
            makeDiagnostic(
              "PTSEM-104",
              "error",
              "An estimate must satisfy optimistic <= most_likely <= pessimistic and pessimistic > 0",
              estimate.span,
              "syntax.estimate",
              declaration.id,
            ),
          );
        }
      }
      const status = fieldNamed(declaration, "status")?.value ?? "planned";
      const blockedReason = fieldNamed(declaration, "blocked_reason");
      if ((status === "blocked") !== (blockedReason !== undefined)) {
        diagnostics.push(
          makeDiagnostic(
            "PTSEM-103",
            "error",
            "blocked_reason is required only when status=blocked",
            blockedReason?.span ?? fieldNamed(declaration, "status")?.span ?? declaration.idSpan,
            "syntax.task",
            declaration.id,
          ),
        );
      }
      validateNonemptyText(declaration, "blocked_reason", diagnostics);
      const requirements = fieldNamed(declaration, "requires");
      if (requirements !== undefined && Array.isArray(requirements.value)) {
        if (requirements.value.length === 0) {
          diagnostics.push(
            makeDiagnostic(
              "PTSEM-101",
              "error",
              "The requires block must contain at least one requirement",
              requirements.span,
              "syntax.task",
              declaration.id,
            ),
          );
        }
        const seen = new Map<string, RequirementValue>();
        for (const requirement of requirements.value as readonly RequirementValue[]) {
          const first = seen.get(requirement.resourceId);
          if (first !== undefined) {
            diagnostics.push(
              makeDiagnostic(
                "PTSEM-110",
                "error",
                `Resource requirement ${requirement.resourceId} is duplicated`,
                requirement.resourceSpan,
                "syntax.task",
                declaration.id,
                [{ message: "First requirement", span: first.resourceSpan }],
              ),
            );
          } else {
            seen.set(requirement.resourceId, requirement);
          }
          if (requirement.units < 1) {
            diagnostics.push(
              makeDiagnostic(
                "PTSEM-109",
                "error",
                "Requirement units must be at least 1",
                requirement.unitsSpan,
                "syntax.resource",
                declaration.id,
              ),
            );
          }
        }
      }
    }
    if (declaration.kind === "gate") {
      requireField(declaration, "reason", diagnostics);
      validateNonemptyText(declaration, "reason", diagnostics);
    }
  }

  if (projects.length !== 1) return;
  const project = projects[0]!;
  const version = fieldNamed(project, "version")?.value ?? 1;
  if (
    typeof version !== "number" ||
    !profile.temporalAnchorGrammarVersions.has(version) ||
    fieldNamed(project, "as_of") !== undefined
  ) {
    return;
  }
  for (const declaration of document.declarations) {
    for (const field of declaration.fields) {
      if (field.name !== "deadline" && field.name !== "not_before") continue;
      diagnostics.push(
        makeDiagnostic(
          "PTSEM-112",
          "error",
          `${declaration.kind} ${declaration.id}.${field.name} requires project.as_of`,
          field.valueSpan,
          "syntax.temporal",
          declaration.id,
        ),
      );
    }
  }
}

function validateGraph(document: DocumentNode, diagnostics: Diagnostic[]): void {
  const firstById = new Map<string, DeclarationNode>();
  for (const declaration of document.declarations) {
    if (reservedWords.has(declaration.id)) {
      diagnostics.push(
        makeDiagnostic(
          "PTSEM-202",
          "error",
          `Reserved word ${declaration.id} cannot be used as an entity ID`,
          declaration.idSpan,
          "syntax",
          declaration.id,
        ),
      );
    }
    const first = firstById.get(declaration.id);
    if (first !== undefined) {
      diagnostics.push(
        makeDiagnostic(
          "PTSEM-201",
          "error",
          `Entity ID ${declaration.id} is duplicated`,
          declaration.idSpan,
          "errors",
          declaration.id,
          [{ message: "First declaration", span: first.idSpan }],
        ),
      );
    } else {
      firstById.set(declaration.id, declaration);
    }
  }
  if (hasErrors(diagnostics)) return;

  const project = document.declarations.find((declaration) => declaration.kind === "project")!;
  const milestones = new Map(
    document.declarations
      .filter((declaration) => declaration.kind === "milestone")
      .map((declaration) => [declaration.id, declaration]),
  );
  const resources = new Map(
    document.declarations
      .filter((declaration) => declaration.kind === "resource")
      .map((declaration) => [declaration.id, declaration]),
  );
  const edges: Edge[] = document.declarations
    .filter((declaration) => declaration.kind === "task" || declaration.kind === "gate")
    .map((declaration) => ({
      declaration,
      id: declaration.id,
      source: declaration.from!,
      target: declaration.to!,
    }));

  const finishField = fieldNamed(project, "finish")!;
  const finish = finishField.value as string;
  const finishEntity = firstById.get(finish);
  if (finishEntity === undefined) {
    diagnostics.push(
      makeDiagnostic(
        "PTSEM-203",
        "error",
        `project.finish ${finish} is undefined`,
        finishField.valueSpan,
        "syntax.project",
        project.id,
      ),
    );
  } else if (finishEntity.kind !== "milestone") {
    diagnostics.push(
      makeDiagnostic(
        "PTSEM-205",
        "error",
        `project.finish ${finish} is not a milestone`,
        finishField.valueSpan,
        "syntax.project",
        project.id,
      ),
    );
  }

  for (const edge of edges) {
    for (const [endpoint, endpointSpan] of [
      [edge.source, edge.declaration.fromSpan!],
      [edge.target, edge.declaration.toSpan!],
    ] as const) {
      const entity = firstById.get(endpoint);
      if (entity === undefined) {
        diagnostics.push(
          makeDiagnostic(
            "PTSEM-204",
            "error",
            `Endpoint ${endpoint} is undefined`,
            endpointSpan,
            `syntax.${edge.declaration.kind}`,
            edge.id,
          ),
        );
      } else if (entity.kind !== "milestone") {
        diagnostics.push(
          makeDiagnostic(
            "PTSEM-205",
            "error",
            `Endpoint ${endpoint} is not a milestone`,
            endpointSpan,
            `syntax.${edge.declaration.kind}`,
            edge.id,
          ),
        );
      }
    }
    if (edge.source === edge.target) {
      diagnostics.push(
        makeDiagnostic(
          "PTDAG-201",
          "error",
          `Edge ${edge.id} is a self-loop`,
          edge.declaration.arrowSpan!,
          "errors",
          edge.id,
        ),
      );
    }
  }

  for (const task of document.declarations.filter((declaration) => declaration.kind === "task")) {
    const requirements = fieldNamed(task, "requires")?.value;
    if (!Array.isArray(requirements)) continue;
    for (const requirement of requirements as readonly RequirementValue[]) {
      const entity = firstById.get(requirement.resourceId);
      if (entity === undefined) {
        diagnostics.push(
          makeDiagnostic(
            "PTSEM-206",
            "error",
            `Resource ${requirement.resourceId} is undefined`,
            requirement.resourceSpan,
            "syntax.resource",
            task.id,
          ),
        );
      } else if (entity.kind !== "resource") {
        diagnostics.push(
          makeDiagnostic(
            "PTSEM-207",
            "error",
            `${requirement.resourceId} is not a resource`,
            requirement.resourceSpan,
            "syntax.resource",
            task.id,
          ),
        );
      } else {
        const capacity = fieldNamed(entity, "capacity")!.value as number;
        if (requirement.units > capacity) {
          diagnostics.push(
            makeDiagnostic(
              "PTSEM-208",
              "error",
              `Requirement ${requirement.units} exceeds capacity ${capacity}`,
              requirement.unitsSpan,
              "syntax.resource",
              task.id,
            ),
          );
        }
      }
    }
  }
  if (hasErrors(diagnostics)) return;

  const outgoing = new Map<string, Edge[]>();
  const incoming = new Map<string, Edge[]>();
  for (const milestone of milestones.keys()) {
    outgoing.set(milestone, []);
    incoming.set(milestone, []);
  }
  for (const edge of edges) {
    outgoing.get(edge.source)!.push(edge);
    incoming.get(edge.target)!.push(edge);
  }
  for (const list of [...outgoing.values(), ...incoming.values()]) {
    list.sort((left, right) => compareStableStrings(left.id, right.id));
  }

  const indegree = new Map([...milestones.keys()].map((id) => [id, incoming.get(id)!.length]));
  const available = [...indegree].filter(([, degree]) => degree === 0).map(([id]) => id).sort();
  let processed = 0;
  while (available.length > 0) {
    const milestone = available.shift()!;
    processed += 1;
    for (const edge of outgoing.get(milestone)!) {
      const next = indegree.get(edge.target)! - 1;
      indegree.set(edge.target, next);
      if (next === 0) {
        available.push(edge.target);
        available.sort(compareStableStrings);
      }
    }
  }
  if (processed !== milestones.size) {
    const cycleEdge = edges
      .filter((edge) => (indegree.get(edge.source) ?? 0) > 0 && (indegree.get(edge.target) ?? 0) > 0)
      .sort((left, right) => compareStableStrings(left.id, right.id))[0];
    diagnostics.push(
      makeDiagnostic(
        "PTDAG-202",
        "error",
        "Detected a directed cycle",
        cycleEdge?.declaration.headerSpan ?? project.idSpan,
        "errors",
        cycleEdge?.id,
      ),
    );
    return;
  }

  if (finishEntity?.kind === "milestone" && outgoing.get(finish)!.length > 0) {
    const firstOutgoing = outgoing.get(finish)![0]!;
    diagnostics.push(
      makeDiagnostic(
        "PTDAG-203",
        "error",
        `Finish milestone ${finish} has an outgoing edge`,
        firstOutgoing.declaration.headerSpan,
        "errors",
        firstOutgoing.id,
      ),
    );
  }

  if (finishEntity?.kind === "milestone") {
    const canReachFinish = new Set<string>([finish]);
    const queue = [finish];
    while (queue.length > 0) {
      const target = queue.shift()!;
      for (const edge of incoming.get(target)!) {
        if (!canReachFinish.has(edge.source)) {
          canReachFinish.add(edge.source);
          queue.push(edge.source);
        }
      }
    }
    for (const milestone of milestones.values()) {
      if (!canReachFinish.has(milestone.id)) {
        diagnostics.push(
          makeDiagnostic(
            "PTDAG-204",
            "error",
            `Milestone ${milestone.id} cannot reach the finish`,
            milestone.idSpan,
            "errors",
            milestone.id,
          ),
        );
      }
    }
  }

  const explicitReached = new Set(
    [...milestones.values()]
      .filter((milestone) => fieldNamed(milestone, "state")?.value === "reached")
      .map((milestone) => milestone.id),
  );
  for (const milestone of milestones.values()) {
    if (incoming.get(milestone.id)!.length === 0 && !explicitReached.has(milestone.id)) {
      diagnostics.push(
        makeDiagnostic(
          "PTDAG-205",
          "error",
          `Root milestone ${milestone.id} must have state reached`,
          fieldNamed(milestone, "state")?.valueSpan ?? milestone.idSpan,
          "errors",
          milestone.id,
        ),
      );
    }
  }
  if (hasErrors(diagnostics)) return;

  const reached = new Set(explicitReached);
  const satisfied = (edge: Edge): boolean => {
    if (!reached.has(edge.source)) return false;
    if (edge.declaration.kind === "gate") return true;
    return (fieldNamed(edge.declaration, "status")?.value ?? "planned") === "done";
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (const milestone of milestones.values()) {
      if (reached.has(milestone.id)) continue;
      const edgesIn = incoming.get(milestone.id)!;
      if (edgesIn.length > 0 && edgesIn.every(satisfied)) {
        reached.add(milestone.id);
        changed = true;
      }
    }
  }
  for (const milestoneId of explicitReached) {
    const edgesIn = incoming.get(milestoneId)!;
    if (edgesIn.length > 0 && !edgesIn.every(satisfied)) {
      const milestone = milestones.get(milestoneId)!;
      diagnostics.push(
        makeDiagnostic(
          "PTDAG-206",
          "error",
          `Reached milestone ${milestoneId} has an unsatisfied incoming edge`,
          fieldNamed(milestone, "state")?.valueSpan ?? milestone.idSpan,
          "errors",
          milestoneId,
        ),
      );
    }
  }
  for (const task of document.declarations.filter((declaration) => declaration.kind === "task")) {
    const status = fieldNamed(task, "status")?.value ?? "planned";
    if ((status === "active" || status === "done") && !reached.has(task.from!)) {
      diagnostics.push(
        makeDiagnostic(
          "PTDAG-207",
          "error",
          `Source of ${status} task ${task.id} is not reached`,
          fieldNamed(task, "status")?.valueSpan ?? task.idSpan,
          "errors",
          task.id,
        ),
      );
    }
  }
  for (const milestoneId of [...reached].sort()) {
    const milestone = milestones.get(milestoneId)!;
    if (!explicitReached.has(milestoneId)) {
      diagnostics.push(
        makeDiagnostic(
          "PTDAG-208",
          "warning",
          `Milestone ${milestoneId} is reached by closure; consider advance`,
          milestone.idSpan,
          "workflows",
          milestoneId,
        ),
      );
    }
  }

  for (const resource of resources.values()) {
    const capacity = fieldNamed(resource, "capacity")!.value as number;
    const activeTasks: DeclarationNode[] = [];
    let usage = 0;
    for (const task of document.declarations.filter((declaration) => declaration.kind === "task")) {
      if ((fieldNamed(task, "status")?.value ?? "planned") !== "active") continue;
      const requirements = fieldNamed(task, "requires")?.value;
      if (!Array.isArray(requirements)) continue;
      const requirement = (requirements as readonly RequirementValue[]).find(
        (candidate) => candidate.resourceId === resource.id,
      );
      if (requirement !== undefined) {
        usage += requirement.units;
        activeTasks.push(task);
      }
    }
    if (usage > capacity) {
      diagnostics.push(
        makeDiagnostic(
          "PTRES-201",
          "error",
          `Active usage ${usage} exceeds capacity ${capacity} of resource ${resource.id}`,
          fieldNamed(resource, "capacity")!.valueSpan,
          "analysis.resources",
          resource.id,
          activeTasks.map((task) => ({ message: `active task ${task.id}`, span: task.idSpan })),
        ),
      );
    }
  }
}

export function validateDocument(
  document: DocumentNode,
  parseDiagnostics: readonly Diagnostic[] = [],
): readonly Diagnostic[] {
  return validateDocumentWithProfile(
    document,
    parseDiagnostics,
    targetGrammar3ValidationProfile,
  );
}

function validateDocumentWithProfile(
  document: DocumentNode,
  parseDiagnostics: readonly Diagnostic[],
  profile: ValidationProfile,
): readonly Diagnostic[] {
  const diagnostics = [...parseDiagnostics];
  if (hasErrors(diagnostics)) return sortDiagnostics(diagnostics);
  validateFieldConstraints(document, diagnostics, profile);
  if (!hasErrors(diagnostics)) validateGraph(document, diagnostics);
  return sortDiagnostics(diagnostics);
}

export function validateTargetDocumentSemantics(
  document: DocumentNode,
  parseDiagnostics: readonly Diagnostic[] = [],
): readonly Diagnostic[] {
  return validateDocumentWithProfile(
    document,
    parseDiagnostics,
    targetValidationProfile,
  );
}

export function validateTargetGrammar3DocumentSemantics(
  document: DocumentNode,
  parseDiagnostics: readonly Diagnostic[] = [],
): readonly Diagnostic[] {
  return validateDocumentWithProfile(
    document,
    parseDiagnostics,
    targetGrammar3ValidationProfile,
  );
}
