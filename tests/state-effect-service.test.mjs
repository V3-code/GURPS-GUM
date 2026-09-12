import assert from "node:assert/strict";
import test from "node:test";

function setPath(target, path, value) {
  const parts = path.split(".");
  if (value === globalThis.foundry?.data?.operators?.ForcedDeletion) {
    const key = parts.pop();
    const parent = parts.reduce((object, part) => object[part], target);
    delete parent[key];
    return;
  }
  const deletion = parts.findIndex(part => part.startsWith("-="));
  if (deletion >= 0) {
    const key = parts[deletion].slice(2);
    const parent = parts.slice(0, deletion).reduce((object, part) => object[part], target);
    delete parent[key];
    return;
  }
  const key = parts.pop();
  const parent = parts.reduce((object, part) => object[part] ??= {}, target);
  parent[key] = value;
}

test("manual group creates persistent effects, records the activation and removes both on disable", async () => {
  const originalSlugify = String.prototype.slugify;
  String.prototype.slugify = function () { return this.toLowerCase().replace(/\s+/g, "-"); };
  globalThis.CONST = { ACTIVE_EFFECT_CHANGE_TYPES: { ADD: 2 } };
  globalThis.game = { combat: null, time: { worldTime: 0 }, users: [], user: { id: "u1", isGM: true }, gum: {} };
  globalThis.ui = { notifications: { error() {}, warn() {} } };
  globalThis.foundry = { data: { operators: { ForcedDeletion: Symbol("ForcedDeletion") } }, utils: {
    randomID: (() => { let id = 0; return () => `random-${++id}`; })(),
    duplicate: value => structuredClone(value),
    deepClone: value => structuredClone(value),
    setProperty: setPath
  }};

  const effects = [];
  const syntheticEffects = [];
  const syntheticActor = {
    effects: syntheticEffects,
    async createEmbeddedDocuments(_type, documents) { syntheticEffects.push(...documents); }
  };
  const actor = {
    effects,
    isOwner: true,
    sheet: { render() {} },
    getActiveTokens: () => [{ actor: syntheticActor }],
    async createEmbeddedDocuments(_type, documents) {
      for (const document of documents) effects.push({ id: `ae-${effects.length + 1}`, ...structuredClone(document) });
    },
    async deleteEmbeddedDocuments(_type, ids) {
      for (const id of ids) effects.splice(effects.findIndex(effect => effect.id === id), 1);
    }
  };
  const item = {
    id: "item-1", uuid: "Actor.a.Item.item-1", name: "Forma",
    parent: actor,
    system: { stateEffectGroups: {
      form: { id: "form", name: "Forma", mode: "manual", active: false, exclusiveSet: "formas", effects: { bonus: { effectUuid: "Item.effect" } } },
      bear: { id: "bear", name: "Urso", mode: "manual", active: true, exclusiveSet: "Formas", effects: { bonus: { effectUuid: "Item.effect" } } }
    } },
    async update(changes) { for (const [path, value] of Object.entries(changes)) setPath(this, path, value); }
  };
  globalThis.fromUuid = async () => ({
    uuid: "Item.effect", name: "Força", img: "", system: {
      duration: { isPermanent: true },
      actions: [{ id: "st", type: "attribute", path: "system.attributes.st.value", operation: "ADD", value: 2 }]
    }
  });

  game.gum.getEffectActions = system => system.actions;
  game.gum.applySingleEffect = async (effectItem, targets, context) => {
    const selected = context.actionIds ? new Set(context.actionIds) : null;
    for (const [actionIndex, action] of effectItem.system.actions.entries()) {
      if (selected && !selected.has(action.id)) continue;
      await targets[0].actor.createEmbeddedDocuments("ActiveEffect", [{
        name: effectItem.name,
        changes: [{ key: action.path, value: action.value }],
        flags: { gum: {
          originItemId: context.originItemId,
          stateEffectGroupId: context.stateEffectGroupId,
          stateEffectLinkId: context.stateEffectLinkId,
          stateEffectActivationId: context.stateEffectActivationId,
          actionIndex,
          actionId: action.id
        }}
      }]);
    }
  };

  const { setStateEffectGroupActive, syncItemStateEffects } = await import("../module/services/state-effect-service.js");
  let report = await syncItemStateEffects(item);
  assert.deepEqual(report.errors, []);
  assert.equal(effects.length, 1);
  assert.equal(syntheticEffects.length, 0, "o token sintético não deve receber efeitos do item do ator-base");
  assert.equal(effects[0].flags.gum.stateEffectGroupId, "bear");
  assert.equal(effects[0].flags.gum.actionId, "st");
  assert.ok(item.system.stateEffectGroups.bear.activationId);

  assert.equal(await setStateEffectGroupActive(item, "form", true), true);
  assert.equal(item.system.stateEffectGroups.bear.active, false);
  assert.equal(effects.length, 1);
  assert.equal(effects[0].flags.gum.stateEffectGroupId, "form");

  assert.equal(await setStateEffectGroupActive(item, "form", false), true);
  assert.equal(effects.length, 0);
  assert.equal(item.system.stateEffectGroups.form.activationId, undefined);
  if (originalSlugify) String.prototype.slugify = originalSlugify;
  else delete String.prototype.slugify;
});