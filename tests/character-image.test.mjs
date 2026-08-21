import test from "node:test";
import assert from "node:assert/strict";
import { resolveCharacterImage } from "../module/utils/character-image.mjs";

const token = (src, actor) => ({ actor, document: { texture: { src } } });

test("aplica a prioridade token, ficha sintética e ficha de origem", () => {
  const source = { id: "a", img: "source.webp" };
  const synthetic = { id: "a", img: "synthetic.webp" };

  assert.equal(resolveCharacterImage(source, { token: token("token.webp", synthetic) }), "token.webp");
  assert.equal(resolveCharacterImage(source, { token: { actor: synthetic } }), "synthetic.webp");
  assert.equal(resolveCharacterImage(source), "source.webp");
});

test("não escolhe uma aparência arbitrária quando há várias cópias ativas", () => {
  const actor = {
    id: "a",
    img: "source.webp",
    getActiveTokens: () => [token("one.webp", actor), token("two.webp", actor)]
  };
  assert.equal(resolveCharacterImage(actor, { canvasRef: { tokens: { controlled: [] } } }), "source.webp");
});