import test from "node:test";
import assert from "node:assert/strict";
import { getSkillDisplayName, setDirectoryEntryLabel } from "../module/utils/skill-display-name.mjs";

test("acrescenta a especialização ao nome de exibição da perícia", () => {
  assert.equal(getSkillDisplayName({ name: "Sobrevivência", system: { specialization: "Deserto" } }), "Sobrevivência (Deserto)");
});

test("mantém somente o nome quando a especialização está vazia", () => {
  assert.equal(getSkillDisplayName({ name: "Furtividade", system: { specialization: "  " } }), "Furtividade");
});

test("atualiza o texto do diretório sem remover seus ícones", () => {
  const icon = { nodeType: 1 };
  const text = { nodeType: 3, textContent: " Sobrevivência" };
  const element = { childNodes: [icon, text], title: "" };

  setDirectoryEntryLabel(element, "Sobrevivência (Deserto)");

  assert.deepEqual(element.childNodes, [icon, text]);
  assert.equal(text.textContent, " Sobrevivência (Deserto)");
  assert.equal(element.title, "Sobrevivência (Deserto)");
});