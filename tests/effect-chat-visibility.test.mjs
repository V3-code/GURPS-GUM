import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  getAttributeRollMessageOptions,
  normalizeAttributeChatVisibility
} from "../module/utils/effect-chat-visibility.mjs";

const users = [
  { id: "gm", isGM: true },
  { id: "owner", isGM: false },
  { id: "observer", isGM: false }
];
const actor = {
  testUserPermission: (user, permission) => permission === "OWNER" && user.id === "owner"
};

test("visibilidade desconhecida mantém mensagens públicas para compatibilidade", () => {
  assert.equal(normalizeAttributeChatVisibility(undefined), "public");
  assert.equal(normalizeAttributeChatVisibility("legacy"), "public");
  assert.deepEqual(
    getAttributeRollMessageOptions({ visibility: "public", actor, users }),
    { messageData: {}, creationOptions: { rollMode: "publicroll" } }
  );
});

test("mensagem privada inclui donos do ator e mestres", () => {
  assert.deepEqual(
    getAttributeRollMessageOptions({ visibility: "owners", actor, users }),
    { messageData: { whisper: ["gm", "owner"] }, creationOptions: {} }
  );
});

test("mensagem exclusiva do mestre usa a rolagem oculta nativa do Foundry", () => {
  assert.deepEqual(
    getAttributeRollMessageOptions({ visibility: "gm", actor, users }),
    { messageData: {}, creationOptions: { rollMode: "blindroll" } }
  );
});

test("Foundry 14 usa messageMode sem emitir o aviso legado de rollMode", () => {
  assert.deepEqual(
    getAttributeRollMessageOptions({ visibility: "public", actor, users, generation: 14 }),
    { messageData: {}, creationOptions: { messageMode: "publicroll" } }
  );
  assert.deepEqual(
    getAttributeRollMessageOptions({ visibility: "gm", actor, users, generation: 14 }),
    { messageData: {}, creationOptions: { messageMode: "blindroll" } }
  );
});

test("opção silenciosa não cria configuração de mensagem", () => {
  assert.equal(getAttributeRollMessageOptions({ visibility: "none", actor, users }), null);
});

test("ficha oferece todas as opções de exibição na ação de atributo", () => {
  const template = fs.readFileSync(new URL("../templates/items/effect-sheet.hbs", import.meta.url), "utf8");
  const attributePanel = template.slice(
    template.indexOf("TIPO: MODIFICADOR DE ATRIBUTO"),
    template.indexOf("TIPO: STATUS")
  );

  assert.match(attributePanel, /name="system\.actions\.\{\{action\.index\}\}\.attribute_chat_visibility"/);
  for (const value of ["public", "owners", "gm", "none"]) {
    assert.match(attributePanel, new RegExp(`option value="${value}"`));
  }
});

test("motor informa a geração do Foundry ao preparar a opção nativa de mensagem", () => {
  const engine = fs.readFileSync(new URL("../scripts/effects-engine.js", import.meta.url), "utf8");
  assert.match(engine, /generation: game\.release\?\.generation/);
  assert.match(engine, /roll\.toMessage\([\s\S]*?messageOptions\.messageData[\s\S]*?}, messageOptions\.creationOptions\)/);
});