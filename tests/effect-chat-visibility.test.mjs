import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  getAttributeRollMessageOptions,
    getResistanceChatPrivacy,
  normalizeAttributeChatVisibility,
  normalizeResistanceChatVisibility
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
    { messageData: {}, creationOptions: { messageMode: "public" } }
  );
  assert.deepEqual(
    getAttributeRollMessageOptions({ visibility: "gm", actor, users, generation: 14 }),
    { messageData: {}, creationOptions: { messageMode: "blind" } }
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

test("Barreira usa Alvo e Mestre por padrão e aceita modo público", () => {
  const activeUsers = users.map(user => ({ ...user, active: true }));
  assert.equal(normalizeResistanceChatVisibility(undefined), "owners");
  assert.deepEqual(
    getResistanceChatPrivacy({ actor, users: activeUsers }),
    { mode: null, whisper: ["owner", "gm"] }
  );
  assert.deepEqual(
    getResistanceChatPrivacy({ visibility: "public", actor, users: activeUsers }),
    { mode: "publicroll", whisper: [] }
  );
});

test("Barreira exclusiva do alvo não inclui Mestre e recua ao Mestre sem proprietário", () => {
  const activeUsers = users.map(user => ({ ...user, active: true }));
  assert.deepEqual(
    getResistanceChatPrivacy({ visibility: "target", actor, users: activeUsers }),
    { mode: null, whisper: ["owner"] }
  );
  assert.deepEqual(
    getResistanceChatPrivacy({ visibility: "target", actor: {}, users: activeUsers }),
    { mode: null, whisper: ["gm"] }
  );
});

test("ficha da Barreira oferece as três opções de visibilidade", () => {
  const template = fs.readFileSync(new URL("../templates/items/effect-sheet.hbs", import.meta.url), "utf8");
  const barrierPanel = template.slice(template.indexOf("BARREIRA DE RESISTÊNCIA"));
  assert.match(barrierPanel, /name="system\.resistanceRoll\.chatVisibility"/);
  for (const value of ["public", "owners", "target"]) {
    assert.match(barrierPanel, new RegExp(`option value="${value}"`));
  }

  const schema = JSON.parse(fs.readFileSync(new URL("../template.json", import.meta.url), "utf8"));
  assert.equal(schema.Item.effect.resistanceRoll.chatVisibility, "owners");
});

test("publicação da Barreira aplica a privacidade persistida no item", () => {
  const main = fs.readFileSync(new URL("../scripts/main.js", import.meta.url), "utf8");
  const resistanceFlow = main.slice(
    main.indexOf("async function _promptActivationResistance"),
    main.indexOf("export async function applyEffectWithResistance")
  );
  assert.match(resistanceFlow, /getResistanceChatPrivacy\(\{[\s\S]*?visibility: rollData\.chatVisibility/);
  assert.match(resistanceFlow, /ChatMessage\.create\(\{ \.\.\.chatData, whisper: privacy\.whisper \}\)/);
});