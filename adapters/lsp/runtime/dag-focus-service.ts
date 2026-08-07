import { inspectEditorDagFocus } from "../../../src/application/editor-dag-focus.js";
import type {
  DagFocusApplicationV1,
} from "../src/protocol.js";

export function createDagFocusApplication(): DagFocusApplicationV1 {
  return Object.freeze({ inspect: inspectEditorDagFocus });
}
