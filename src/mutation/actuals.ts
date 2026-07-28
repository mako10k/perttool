import type {
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

function serializeFinishEvent(
  request: NormalizedFinishActualsRequest,
  lineEnding: string,
): string {
  const fields = [
    `work_event ${request.event.id}:`,
    "  model 1",
    `  task ${request.taskId}`,
    "  kind finish",
    `  occurred_at ${request.event.occurredAt}`,
    ...(request.event.activeTime === null
      ? []
      : [`  active_time ${request.event.activeTime}`]),
    ...(request.event.effort === null
      ? []
      : [`  effort ${request.event.effort}`]),
  ];
  return fields.join(lineEnding);
}

export function planFinishActualsEdits(
  text: string,
  validated: TargetGrammar5ValidatedDocument,
  request: NormalizedFinishActualsRequest,
  fromState: TaskLifecycleState,
): FinishActualsEditPlan {
  const task = validated.document.declarations.find(
    (declaration) =>
      declaration.kind === "task" && declaration.id === request.taskId,
  );
  if (task === undefined) {
    throw new Error("validated finish-actuals edit plan lost its task");
  }
  const project = validated.document.declarations.find(
    (declaration) => declaration.kind === "project",
  );
  if (project === undefined) {
    throw new Error("validated finish-actuals edit plan lost its project");
  }
  const edits: TextEdit[] = [];
  const taskEditor = new EntityEditor(
    text,
    task,
    TARGET_GRAMMAR_5_DECLARATION_FIELD_ORDER.task,
  );
  taskEditor.setScalar("status", "done");
  if (fromState === "blocked") taskEditor.clear("blocked_reason");
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
      serializeFinishEvent(request, lineEnding),
      lineEnding,
    ),
  );
  return Object.freeze({
    edits: Object.freeze(edits),
    task,
    fromState,
  });
}
