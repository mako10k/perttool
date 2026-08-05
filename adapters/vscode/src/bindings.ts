export const editorProtocolModelVersion = 1 as const;
export const graphViewResultSchemaVersion =
  "Perttool.GraphViewResult.v1" as const;
export const editorHelpResultSchemaVersion =
  "Perttool.EditorHelpResult.v1" as const;

export interface OpenHelpCommandArgsV1 {
  readonly documentUri: string;
  readonly documentGeneration: string;
  readonly documentVersion: number;
  readonly topicId: string;
}

export interface EditorHelpResultV1 {
  readonly schemaVersion: typeof editorHelpResultSchemaVersion;
  readonly editorProtocolModelVersion: typeof editorProtocolModelVersion;
  readonly status: "ok" | "not_found";
  readonly topicId: string;
  readonly level: "quick" | "detail";
  readonly content: { readonly kind: "markdown"; readonly value: string } | null;
  readonly relatedTopicIds: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  return (
    actual.length === expected.length &&
    expected.every((key, index) => actual[index] === key)
  );
}

export function parseOpenHelpCommandArgs(
  value: unknown,
): OpenHelpCommandArgsV1 | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "documentGeneration",
      "documentUri",
      "documentVersion",
      "topicId",
    ]) ||
    typeof value.documentUri !== "string" ||
    value.documentUri.length === 0 ||
    typeof value.documentGeneration !== "string" ||
    value.documentGeneration.length === 0 ||
    !Number.isSafeInteger(value.documentVersion) ||
    (value.documentVersion as number) < 0 ||
    typeof value.topicId !== "string" ||
    value.topicId.length === 0
  ) {
    return null;
  }
  return {
    documentUri: value.documentUri,
    documentGeneration: value.documentGeneration,
    documentVersion: value.documentVersion as number,
    topicId: value.topicId,
  };
}

export function parseEditorHelpResult(value: unknown): EditorHelpResultV1 | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "content",
      "editorProtocolModelVersion",
      "level",
      "relatedTopicIds",
      "schemaVersion",
      "status",
      "topicId",
    ]) ||
    value.schemaVersion !== editorHelpResultSchemaVersion ||
    value.editorProtocolModelVersion !== editorProtocolModelVersion ||
    (value.status !== "ok" && value.status !== "not_found") ||
    typeof value.topicId !== "string" ||
    (value.level !== "quick" && value.level !== "detail") ||
    !Array.isArray(value.relatedTopicIds) ||
    !value.relatedTopicIds.every((item) => typeof item === "string")
  ) {
    return null;
  }
  let content: EditorHelpResultV1["content"] = null;
  if (value.content !== null) {
    if (
      !isRecord(value.content) ||
      !hasExactKeys(value.content, ["kind", "value"]) ||
      value.content.kind !== "markdown" ||
      typeof value.content.value !== "string"
    ) {
      return null;
    }
    content = { kind: "markdown", value: value.content.value };
  }
  if (
    (value.status === "ok" && content === null) ||
    (value.status === "not_found" &&
      (content !== null || value.relatedTopicIds.length !== 0))
  ) {
    return null;
  }
  return {
    schemaVersion: editorHelpResultSchemaVersion,
    editorProtocolModelVersion,
    status: value.status,
    topicId: value.topicId,
    level: value.level,
    content,
    relatedTopicIds: [...value.relatedTopicIds] as string[],
  };
}

export function hasAcceptedEditorHandshake(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const perttool = value.perttool;
  return (
    isRecord(perttool) &&
    perttool.editorProtocolModelVersion === editorProtocolModelVersion &&
    perttool.graphViewResultSchemaVersion === graphViewResultSchemaVersion &&
    perttool.editorHelpResultSchemaVersion === editorHelpResultSchemaVersion
  );
}

export function graphBindingMatches(
  value: unknown,
  expected: OpenHelpCommandArgsV1,
): boolean {
  if (
    !isRecord(value) ||
    value.schemaVersion !== graphViewResultSchemaVersion ||
    value.editorProtocolModelVersion !== editorProtocolModelVersion ||
    !isRecord(value.document)
  ) {
    return false;
  }
  return (
    value.document.uri === expected.documentUri &&
    value.document.generation === expected.documentGeneration &&
    value.document.version === expected.documentVersion
  );
}
