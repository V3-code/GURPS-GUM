import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createTestRequest } from "../module/utils/test-request-data.mjs";
import { formatTestRequestStatus, prepareModifierBreakdown, prepareResponseHistory } from "../module/utils/test-request-view.mjs";

const english = JSON.parse(await readFile(new URL("../lang/en.json", import.meta.url), "utf8"));

function resolveKey(key) {
  return key.split(".").reduce((value, part) => value?.[part], english) ?? key;
}

function withEnglish(callback) {
  const previousGame = globalThis.game;
  globalThis.game = { i18n: { localize: resolveKey } };
  try {
    return callback();
  } finally {
    globalThis.game = previousGame;
  }
}

test("test request statuses and modifier labels follow the active language", () => withEnglish(() => {
  assert.equal(formatTestRequestStatus({ outcome: "success", resultLabel: "Sucesso", margin: 3 }), "Success (3)");
  assert.equal(formatTestRequestStatus({ outcome: "critical-failure", resultLabel: "Falha Crítica", margin: -10 }), "Critical Failure");
  assert.deepEqual(prepareModifierBreakdown({ totalModifier: 2 }, 1, ""), [
    { label: "GM Modifier", value: 1, valueLabel: "+1" },
    { label: "Other modifiers", value: 1, valueLabel: "+1" }
  ]);
}));

test("test request localization does not alter response history mechanics", () => withEnglish(() => {
  const request = createTestRequest({ targets: [{ targetKey: "Actor.a" }] }, { id: "request", now: 1 });
  assert.equal(request.title, "Test Requested by the GM");
  const response = { total: 9, effectiveTarget: 12, margin: 3, history: [{ total: 10, effectiveTarget: 12, margin: 2, outcome: "success", resultLabel: "Sucesso" }] };
  const history = prepareResponseHistory(response);
  assert.equal(history.historyCount, 1);
  assert.equal(history.previous.total, 10);
  assert.equal(history.previous.status, "Success (2)");
}));
