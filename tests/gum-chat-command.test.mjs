import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gumChatInputText, installGumChatCommandInterceptor, isSafeDamageFormula, parseGumChatCommand, parseNhExpression, resolveGumCommandActor, splitSkillModifier } from "../module/utils/gum-chat-command.mjs";

test("ignores messages outside the GUM namespace and provides help", () => {
  assert.equal(parseGumChatCommand("/roll 3d6"), null);
  assert.deepEqual(parseGumChatCommand("/gum"), { type: "help" });
  assert.deepEqual(parseGumChatCommand("/gum ajuda"), { type: "help", topic: "" });
});

test("reads the rich-text payload produced by the Foundry 14 chat editor", () => {
  assert.equal(gumChatInputText("<p>/gum&nbsp;nh 14-4</p>"), "/gum nh 14-4");
  assert.deepEqual(parseGumChatCommand("<p>/gum nh 14-4</p>"), { type: "nh", value: 14, modifier: -4 });
  assert.deepEqual(parseGumChatCommand({ content: "<p>/gum dmg 3d6+1 cont</p>" }), { type: "damage", formula: "3d6+1", damageType: "cont" });
  assert.deepEqual(parseGumChatCommand({ textContent: "/gum" }), { type: "help" });
});

test("accepts every documented NH alias with compact or spaced modifiers", () => {
  for (const alias of ["nh", "n", "niv", "nivel", "nível"]) {
    assert.deepEqual(parseGumChatCommand(`/gum ${alias} 14-4`), { type: "nh", value: 14, modifier: -4 });
  }
  assert.deepEqual(parseGumChatCommand("/gum nh 14 + 2"), { type: "nh", value: 14, modifier: 2 });
  assert.equal(parseNhExpression("14x-2"), null);
});

test("accepts damage aliases and rejects unsafe formulae", () => {
  for (const alias of ["dmg", "d", "damage", "dano"]) {
    assert.deepEqual(parseGumChatCommand(`/gum ${alias} 3d6+1 cont`), { type: "damage", formula: "3d6+1", damageType: "cont" });
  }
  assert.equal(isSafeDamageFormula("2d+1"), false);
  assert.equal(parseGumChatCommand("/gum dmg @attributes.st cont").type, "error");
  assert.deepEqual(parseGumChatCommand("<p>/gum dmg 3d6 <b>cont</b></p>"), { type: "damage", formula: "3d6", damageType: "cont" });
  assert.equal(parseGumChatCommand("/gum dmg 3d6 <img src=x onerror=alert(1)>").type, "error");
});

test("treats remaining input as a skill and separates a trailing modifier", () => {
  assert.deepEqual(parseGumChatCommand("/gum primeiros socorros+1"), { type: "skill", query: "primeiros socorros+1" });
  assert.deepEqual(splitSkillModifier("Primeiros Socorros+1"), { name: "Primeiros Socorros", modifier: 1 });
  assert.deepEqual(splitSkillModifier("Furtividade - 4"), { name: "Furtividade", modifier: -4 });
});

test("uses the only actor owned by a player even when it has no scene token", () => {
  const user = { id: "player", isGM: false };
  const owned = { id: "hero", type: "character", ownership: { player: 3 } };
  const other = { id: "npc", type: "character", ownership: { player: 0 } };
  assert.deepEqual(resolveGumCommandActor({ actors: [owned, other], user }), {
    actor: owned,
    multiple: false,
    ambiguousOwners: false
  });
});

test("keeps token and assigned-character priority and reports ambiguous ownership", () => {
  const user = { id: "player", isGM: false };
  const tokenActor = { id: "token" };
  const assigned = { id: "assigned" };
  const owned = [1, 2].map(id => ({ id, type: "character", testUserPermission: () => true }));
  assert.equal(resolveGumCommandActor({ controlledTokens: [{ actor: tokenActor }], assignedActor: assigned, actors: owned, user }).actor, tokenActor);
  assert.equal(resolveGumCommandActor({ assignedActor: assigned, actors: owned, user }).actor, assigned);
  assert.deepEqual(resolveGumCommandActor({ actors: owned, user }), { actor: null, multiple: false, ambiguousOwners: true });
  assert.deepEqual(resolveGumCommandActor({ actors: owned, user: { ...user, isGM: true } }), { actor: null, multiple: false, ambiguousOwners: false });
});

test("intercepts GUM before Foundry validates slash commands and delegates other messages", async () => {
  const processed = [];
  const executed = [];
  const chatLog = { async processMessage(message) { processed.push(message); return "foundry"; } };
  assert.equal(installGumChatCommandInterceptor(chatLog, command => executed.push(command)), true);
  assert.equal(await chatLog.processMessage("/roll 3d6"), "foundry");
  assert.equal(await chatLog.processMessage("/gum"), null);
  assert.equal(await chatLog.processMessage("<p>/gum nh 14</p>"), null);
  assert.deepEqual(processed, ["/roll 3d6"]);
  assert.deepEqual(executed, [{ type: "help" }, { type: "nh", value: 14, modifier: 0 }]);

  // Installing twice must not wrap or execute a command twice.
  assert.equal(installGumChatCommandInterceptor(chatLog, command => executed.push(command)), true);
  await chatLog.processMessage("/gum nh 12");
  assert.equal(executed.length, 3);
});

test("wires the interceptor into Foundry startup and shows private help", async () => {
  const source = await readFile(new URL("../scripts/main.js", import.meta.url), "utf8");
  assert.match(source, /installGumChatCommandInterceptor\(ui\.chat/);
  assert.doesNotMatch(source, /Hooks\.on\("chatMessage"/);
  assert.match(source, /_registerGumChatCommands\(\)/);
  assert.match(source, /await _showGumCommandHelp\(\{ startup: true \}\)\.catch/);
  assert.match(source, /whisper: \[game\.user\.id\]/);
});