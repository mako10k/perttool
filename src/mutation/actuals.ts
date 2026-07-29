import type {
  NormalizedLifecycleMutationRequest,
  NormalizedFinishActualsRequest,
  TaskLifecycleState,
} from "../actuals/lifecycle.js";
import {
  TARGET_GRAMMAR_5_DECLARATION_FIELD_ORDER,
} from "../model/declaration-fields.js";
import type {
  DeclarationNode,
  TargetDeclarationKind,
} from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import type {
  TargetGrammar5ValidatedDocument,
} from "../semantic/target-validator.js";
import { EntityEditor } from "./entity-editor.js";
import {
  appendDeclarationEdit,
  majorLineEnding,
} from "./source.js";
import type { TextEdit } from "./text-edits.js";

export interface FinishActualsEditPlan {
  readonly edits: readonly TextEdit[];
  readonly task: DeclarationNode<TargetDeclarationKind>;
  readonly fromState: TaskLifecycleState;
}

export interface LifecycleEditPlan {
  readonly edits: readonly TextEdit[];
  readonly task: DeclarationNode<TargetDeclarationKind>;
  readonly fromState: TaskLifecycleState;
}

function lifecycleEventKind(
  request: NormalizedLifecycleMutationRequest,
): "start" | "suspend" | "resume" | "finish" {
  return request.kind === "task.finish.actual"
    ? "finish"
    : request.kind.slice("task.".length) as "start" | "suspend" | "resume";
}

function serializeLifecycleEvent(
  request: NormalizedLifecycleMutationRequest,
  plannedValue: string | null,
  lineEnding: string,
): string {
  const fields = [
    `work_event ${request.event.id}:`,
    "  model 1",
    `  task ${request.taskId}`,
    `  kind ${lifecycleEventKind(request)}`,
    `  occurred_at ${request.event.occurredAt}`,
    ...(plannedValue === null
      ? []
      : [`  planned_value ${plannedValue}`]),
    ...(request.kind !== "task.finish.actual" ||
        request.event.activeTime === null
      ? []
      : [`  active_time ${request.event.activeTime}`]),
    ...(request.kind !== "task.finish.actual" ||
        request.event.effort === null
      ? []
      : [`  effort ${request.event.effort}`]),
    ...(request.kind !== "task.suspend" || request.event.reason === null
      ? []
      : [`  reason ${JSON.stringify(request.event.reason)}`]),
  ];
  return fields.join(lineEnding);
}

export function planLifecycleEdits(
  text: string,
  validated: TargetGrammar5ValidatedDocument,
  request: NormalizedLifecycleMutationRequest,
  fromState: TaskLifecycleState,
  plannedValue: string | null,
): LifecycleEditPlan {
  const task = validated.document.declarations.find(
    (declaration) =>
      declaration.kind === "task" && declaration.id === request.taskId,
  );
  if (task === undefined) {
    throw new Error("validated lifecycle edit plan lost its task");
  }
  const project = validated.document.declarations.find(
    (declaration) => declaration.kind === "project",
  );
  if (project === undefined) {
    throw new Error("validated lifecycle edit plan lost its project");
  }
  const edits: TextEdit[] = [];
  const taskEditor = new EntityEditor(
    text,
    task,
    TARGET_GRAMMAR_5_DECLARATION_FIELD_ORDER.task,
  );
  const targetState: TaskLifecycleState =
    request.kind === "task.start" || request.kind === "task.resume"
      ? "active"
      : request.kind === "task.suspend"
        ? "suspended"
        : "done";
  taskEditor.setScalar("status", targetState);
  if (
    fromState === "blocked" &&
    request.kind === "task.finish.actual"
  ) {
    taskEditor.clear("blocked_reason");
  }
  edits.push(...taskEditor.finish());

  const version = fieldNamed(project, "version")?.value ?? 1;
  if (version !== 5) {
    const projectEditor = new EntityEditor(
      text,
      project,
      TARGET_GRAMMAR_5_DECLARATION_FIELD_ORDER.project,
    );
    projectEditor.setScalar("version", "5");
    edits.push(...projectEditor.finish());
  }
  const lineEnding = majorLineEnding(text);
  edits.push(
    appendDeclarationEdit(
      text,
      serializeLifecycleEvent(request, plannedValue, lineEnding),
      lineEnding,
    ),
  );
  const merged: TextEdit[] = [];
  for (const edit of edits) {
    const previous = merged.at(-1);
    if (
      previous !== undefined &&
      previous.startOffset === edit.startOffset &&
      previous.endOffset === edit.endOffset &&
      edit.startOffset === edit.endOffset
    ) {
      merged[merged.length - 1] = Object.freeze({
        startOffset: edit.startOffset,
        endOffset: edit.endOffset,
        replacement: previous.replacement + edit.replacement,
      });
    } else {
      merged.push(edit);
    }
  }
  return Object.freeze({
    edits: Object.freeze(merged),
    task,
    fromState,
  });
}

export function planFinishActualsEdits(
  text: string,
  validated: TargetGrammar5ValidatedDocument,
  request: NormalizedFinishActualsRequest,
  fromState: TaskLifecycleState,
): FinishActualsEditPlan {
  return planLifecycleEdits(
    text,
    validated,
    request,
    fromState,
    null,
  );
}
