import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const engine = fs.readFileSync(new URL("../scripts/effects-engine.js", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../styles/test-request.css", import.meta.url), "utf8");

test("mensagem de efeito com teste não aninha o card de mensagem no card de rolagem", () => {
  assert.match(engine, /description: chatBody/);
  assert.doesNotMatch(engine, /description: content, origin: \{ type: "effect-chat"/);
  assert.match(engine, /effectName: effectItem\.name/);
});

test("card de teste de efeito força conteúdo e alvo a manter altura compacta", () => {
  assert.match(styles, /\.chat-message \.gum-chat-roll-request,[\s\S]*?height: auto !important; min-height: 0;/);
  assert.match(styles, /\.gum-chat-roll-request \.request-target-row \{ display: flex; flex-direction: column; \}/);
});
