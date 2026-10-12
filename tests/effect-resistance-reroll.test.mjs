import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const main = fs.readFileSync(new URL("../scripts/main.js", import.meta.url), "utf8");
const view = fs.readFileSync(new URL("../module/utils/roll-request-view.mjs", import.meta.url), "utf8");

test("barreira usa âncora persistente para manter o resultado dentro do card", () => {
  assert.match(view, /data-gum-request-result-anchor/);
  assert.match(view, /updated\.includes\(anchor\)/);
});

test("barreira permite rerrolagem sem reaplicar um efeito já aplicado", () => {
  assert.match(main, /\.resistance-roll-button, \.resistance-reroll-button/);
  assert.match(main, /reroll: isReroll/);
  assert.match(main, /barrier\.shouldApply && !wasEffectApplied/);
  assert.match(main, /rerollClass: "resistance-reroll-button"/);
});
