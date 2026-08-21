import test from "node:test";
import assert from "node:assert/strict";
import { resolveRollPromptImage } from "../module/utils/roll-prompt-image.mjs";

const token = (src, actor) => ({ actor, document: { texture: { src } } });

test("prioriza a imagem explícita do token de origem", () => {
  const actor = { img: "actor.webp" };
  assert.equal(resolveRollPromptImage(actor, { tokenImg: "origin.webp", img: "item.webp" }, {}), "origin.webp");
});

test("usa o token sintético do ator antes do retrato", () => {
  const actor = { img: "actor.webp", token: { texture: { src: "synthetic.webp" } } };
  assert.equal(resolveRollPromptImage(actor, {}, {}), "synthetic.webp");
});

test("usa o token controlado para distinguir tokens vinculados ao mesmo ator", () => {
  const actor = { id: "actor-1", img: "actor.webp", getActiveTokens: () => [] };
  const other = { id: "actor-2" };
  const canvas = { tokens: { controlled: [token("other.webp", other), token("chosen.webp", actor)] } };
  assert.equal(resolveRollPromptImage(actor, {}, canvas), "chosen.webp");
});

test("usa um único token ativo e evita escolher arbitrariamente entre vários", () => {
  const actor = { img: "actor.webp", getActiveTokens: () => [token("only.webp")] };
  assert.equal(resolveRollPromptImage(actor, {}, { tokens: { controlled: [] } }), "only.webp");

  actor.getActiveTokens = () => [token("one.webp"), token("two.webp")];
  assert.equal(resolveRollPromptImage(actor, {}, { tokens: { controlled: [] } }), "actor.webp");
});

test("recorre ao retrato do ator e depois aos fallbacks", () => {
  assert.equal(resolveRollPromptImage({ img: "actor.webp" }, { img: "item.webp" }, {}), "actor.webp");
  assert.equal(resolveRollPromptImage({}, { img: "item.webp" }, {}), "item.webp");
  assert.equal(resolveRollPromptImage({}, {}, {}), "icons/svg/d20.svg");
});

test("usa o retrato da ficha sintética do token antes da ficha de origem", () => {
  const syntheticActor = { id: "actor-1", img: "synthetic-actor.webp" };
  const actor = { id: "actor-1", img: "source.webp", token: { actor: syntheticActor } };
  assert.equal(resolveRollPromptImage(actor, {}, {}), "synthetic-actor.webp");
});