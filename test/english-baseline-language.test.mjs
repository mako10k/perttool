import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  auditEnglishBaseline,
  auditJapaneseScriptFiles,
} from "../scripts/check-english-baseline.mjs";
import { parseDocument } from "../dist/index.js";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const fixtureContracts = {
  "test/fixtures/e2e/active-resource.pert": {
    layout:
      "bdf5cea6f8da45c04964027ee9e77aafddc1f4b0d5fb52e6c5b51802b36ca5fa",
    structure:
      "84b64863d8ddfc26a7c798a5846981444d9651ffa8aba4f1617c7e0746bc0614",
  },
  "test/fixtures/e2e/blocked-approval.pert": {
    layout:
      "b59803107358db7b8327f67b77ccdbf2e9489b58e39173b9fb0cca838d1ca37a",
    structure:
      "cb7bd1dd4ff843c37333326c29c60a65f02d311beb10ba3ca0c7d8a5fb98ae17",
  },
  "test/fixtures/e2e/capacity-what-if.pert": {
    layout:
      "ccc8303e16be23f61b12889e0e3845b3ca94a46e999b183fc33ec85490f51626",
    structure:
      "09444658f033e2f291071035c594ee63b8ec71ff40a2ebbbe7bd0a7eb5a5224f",
  },
  "test/fixtures/e2e/invalid-resource.pert": {
    layout:
      "10876ec8f081186a36b8672b8ee985e4ef34cac844e06ee8a0ef38e18aa75f2f",
    structure:
      "e5e1af047766d4aa3e9bf4730eded83d137f8664eaa03d573796208fcbcc97b5",
  },
  "test/fixtures/e2e/progress-after.pert": {
    layout:
      "615d52260e30a60b4c8cc30e21e5a3921e84c53cfa32bb3884dc506c94bc6c34",
    structure:
      "0d02042ea5627d96193392195c10ed7f0866c410d1f6e4bd7d24e8ebb79eef4b",
  },
  "test/fixtures/e2e/progress-before.pert": {
    layout:
      "f3b6b0d8dc0591adbdfa085261fac834ae3d5f8188c4e24d8fc1a8e2e653d6c1",
    structure:
      "688c98f00c917075deb636fc374c8deb6f5d273225736ad62e2a29c42d1a23d7",
  },
  "test/fixtures/invalid/cycle.pert": {
    layout:
      "9ca1d80d798904ac6bccb56f25c764aa38067558650e9673a0e0987c3b9503d6",
    structure:
      "f54b427760d5a854bc6512e641e64d6517519d7bd56052e4fe5393e3c559e576",
  },
  "test/fixtures/invalid/duplicate-id.pert": {
    layout:
      "240cef69cc562085ce28e926b28387f86ec7646fa8e508980eb05d1af2bc5b97",
    structure:
      "fe6b2c0828459949047a690c66828358364a1f772940c08d42954e44389bdaa9",
  },
  "test/fixtures/invalid/estimate-order.pert": {
    layout:
      "316a4a8b69a3f222361760453d0878a670850923576925b9655b97a33907930e",
    structure:
      "b9b0350fe34da93819b4630e68cadc4d42a64cdb0df941b94e700cd2fdb5b009",
  },
  "test/fixtures/invalid/undefined-endpoint.pert": {
    layout:
      "2e1bc8e529de66d49745110b9d04124022ac9bc16794835a727aac2ddc0d69d7",
    structure:
      "3f2f2317772d43d626b26ac308aaeebb6b764e8f03be37f81da6e3df1e4a80ae",
  },
};
const proseFields = new Set([
  "title",
  "description",
  "reason",
  "blocked_reason",
]);

function digest(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function maskQuotedText(text) {
  return text.replace(
    /"[^"\n]*"/gu,
    (quoted) => `"${"x".repeat(quoted.length - 2)}"`,
  );
}

function structuralValue(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(structuralValue);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) => key !== "text" && key !== "span" && !key.endsWith("Span"),
      )
      .map(([key, nested]) => [key, structuralValue(nested)]),
  );
}

function structuralField(field) {
  return {
    name: field.name,
    value: structuralValue(field.value),
    children: field.children?.map(structuralField),
  };
}

function structuralDocument(document) {
  return document.declarations.map((declaration) => ({
    kind: declaration.kind,
    id: declaration.id,
    from: declaration.from,
    to: declaration.to,
    fields: declaration.fields
      .filter((field) => !proseFields.has(field.name))
      .map(structuralField),
  }));
}

test("repository Japanese-script content matches the exact allowlist", async () => {
  const result = await auditEnglishBaseline(repositoryRoot);
  assert.deepEqual(result.errors, []);
  assert.equal(result.matchCount, 3);
});

test("Japanese-script allowlist is exact and fails closed", () => {
  const allowedLine = "\u30c6\u30b9\u30c8";
  const allowlist = {
    schema: "Perttool.EnglishBaselineJapaneseScriptAllowlist.v1",
    entries: [
      {
        path: "fixture.txt",
        line: allowedLine,
        occurrences: 1,
        reason: "Intentional Unicode fixture.",
      },
    ],
  };

  assert.deepEqual(
    auditJapaneseScriptFiles(
      [{ path: "fixture.txt", text: `${allowedLine}\nemoji \ud83d\ude00\n` }],
      allowlist,
    ).errors,
    [],
  );
  assert.match(
    auditJapaneseScriptFiles(
      [{ path: "fixture.txt", text: `${allowedLine}\n\u8ffd\u52a0\n` }],
      allowlist,
    ).errors[0],
    /is not allowlisted/u,
  );
  assert.match(
    auditJapaneseScriptFiles(
      [{ path: "fixture.txt", text: "English only\n" }],
      allowlist,
    ).errors[0],
    /expected 1 occurrence/u,
  );
  assert.deepEqual(
    auditJapaneseScriptFiles(
      [{ path: "fixture.txt", text: "\\u30c6\\u30b9\\u30c8\n" }],
      { ...allowlist, entries: [] },
    ).errors,
    [],
  );
});

test("translated fixtures preserve source layout and semantic structure", async () => {
  for (const [fixturePath, contract] of Object.entries(fixtureContracts)) {
    const source = await readFile(path.join(repositoryRoot, fixturePath), "utf8");
    assert.equal(digest(maskQuotedText(source)), contract.layout, fixturePath);

    const parsed = parseDocument(source);
    assert.equal(
      digest(JSON.stringify(structuralDocument(parsed.document))),
      contract.structure,
      fixturePath,
    );
  }
});
