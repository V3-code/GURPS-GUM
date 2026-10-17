import test from "node:test";
import assert from "node:assert/strict";
import {
  parseItemBundle,
  prepareItemBundle,
  previewItemBundleSynchronization,
  stableBundleDocumentId
} from "../module/utils/item-bundle-json.mjs";

const bundle = () => ({
  format: "gum-item-bundle",
  version: 1,
  id: "flaming-sword",
  root: "sword",
  documents: {
    burning: {
      name: "Burning",
      type: "effect",
      img: "burning.webp",
      system: { schemaVersion: 2, actions: [] }
    },
    fine: {
      name: "Fine",
      type: "eqp_modifier",
      img: "fine.webp",
      system: {
        enabled: true,
        level: 1,
        adjustment_schema: 1,
        cost_adjustment: "+3 CF",
        weight_mod: "x1",
        cost_adjustment_data: { expression: "+3 CF", stage: "base" },
        weight_adjustment_data: { expression: "x1", stage: "base" },
        features_data: {
          aura: { id: "aura", type: "granted_effect", effectRef: "burning", effect_domain: "wearer" }
        }
      }
    },
    sword: {
      name: "Flaming Sword",
      type: "equipment",
      system: {
        onDamageEffects: {
          burning: { id: "burning-link", effectRef: "burning", minInjury: 1 }
        },
        eqp_modifiers: {
          fine: { id: "fine-instance", modifierRef: "fine", level: 2 }
        }
      }
    }
  }
});

test("recognizes only the item-bundle format and validates its root", () => {
  assert.equal(parseItemBundle({ type: "equipment" }), null);
  assert.throws(() => parseItemBundle({ ...bundle(), version: 2 }), /Unsupported/);
  assert.throws(() => parseItemBundle({ ...bundle(), root: "missing" }), /does not exist/);
  const unsupported = bundle();
  unsupported.documents.sword.type = "not-a-gum-item";
  assert.throws(() => parseItemBundle(unsupported), /unsupported Item type/);
  assert.equal(parseItemBundle(bundle()).root, "sword");
});

test("generates stable Foundry-sized IDs", () => {
  const first = stableBundleDocumentId("bundle", "effect");
  assert.equal(first.length, 16);
  assert.match(first, /^[A-Za-z0-9]{16}$/);
  assert.equal(stableBundleDocumentId("bundle", "effect"), first);
  assert.notEqual(stableBundleDocumentId("bundle", "equipment"), first);
});

test("resolves effect references and embeds equipment modifier snapshots", () => {
  const source = bundle();
  source.documents.enhancement = {
    name: "Area Effect",
    type: "modifier",
    system: { cost: "+50%", level: 1, affects: "total", disabled: false, description: "Wider area" }
  };
  source.documents.blessing = {
    name: "Blessing",
    type: "advantage",
    system: {
      passiveEffects: { burning: { effectRef: "burning" } },
      modifiers: { area: { traitModifierRef: "enhancement", level: 2 } }
    }
  };
  source.documents.condition = {
    name: "Burning condition",
    type: "condition",
    system: {}
  };
  source.documents.sword.system.generalConditions = {
    burning: { conditionRef: "condition" }
  };
  source.documents.sword.system.melee_attacks = {
    slash: { onDamageEffects: { burning: { effectRef: "burning" } } }
  };
  const prepared = prepareItemBundle(source, "world.imported-items");
  const byKey = Object.fromEntries(prepared.documents.map(entry => [entry.key, entry]));
  const effectUuid = byKey.burning.uuid;
  const equipment = byKey.sword.data.system;
  const modifier = equipment.eqp_modifiers.fine;
  const advantage = byKey.blessing.data.system;

  assert.equal(equipment.onDamageEffects.burning.effectUuid, effectUuid);
  assert.equal(equipment.melee_attacks.slash.onDamageEffects.burning.effectUuid, effectUuid);
  assert.equal(equipment.generalConditions.burning.uuid, byKey.condition.uuid);
  assert.equal(advantage.passiveEffects.burning.effectUuid, effectUuid);
  assert.equal(advantage.modifiers.area.name, "Area Effect");
  assert.equal(advantage.modifiers.area.cost, "+50%");
  assert.equal(advantage.modifiers.area.level, 2);
  assert.equal(advantage.modifiers.area.source_id, byKey.enhancement.uuid);
  assert.equal(advantage.modifiers.area.traitModifierRef, undefined);
  assert.equal(equipment.onDamageEffects.burning.name, "Burning");
  assert.equal(modifier.name, "Fine");
  assert.equal(modifier.level, 2);
  assert.equal(modifier.source_uuid, byKey.fine.uuid);
  assert.equal(modifier.features_data.aura.effect_uuid, effectUuid);
  assert.equal(modifier.features_data.aura.effect_name, "Burning");
  assert.equal(modifier.features_data.aura.effect_img, "burning.webp");
  assert.equal(modifier.modifierRef, undefined);
  assert.equal(byKey.sword.root, true);
  assert.equal(prepared.documents.at(-1).key, "sword");
  assert.equal(source.documents.sword.system.onDamageEffects.burning.effectUuid, undefined);
});

test("rejects missing references and references to the wrong item type", () => {
  const missing = bundle();
  missing.documents.sword.system.onDamageEffects.burning.effectRef = "unknown";
  assert.throws(() => prepareItemBundle(missing, "world.items"), /Unknown bundle reference/);

  const wrongType = bundle();
  wrongType.documents.sword.system.onDamageEffects.burning.effectRef = "fine";
  assert.throws(() => prepareItemBundle(wrongType, "world.items"), /must target effect/);

  const wrongTraitModifier = bundle();
  wrongTraitModifier.documents.trait = {
    name: "Trait",
    type: "advantage",
    system: { modifiers: { invalid: { traitModifierRef: "fine" } } }
  };
  assert.throws(() => prepareItemBundle(wrongTraitModifier, "world.items"), /must target modifier/);

  const misplaced = bundle();
  misplaced.documents.sword.system.unexpected = { traitModifierRef: "fine" };
  assert.throws(() => prepareItemBundle(misplaced, "world.items"), /not allowed/);

  const conflicting = bundle();
  conflicting.documents.sword.system.passiveEffects = {
    conflict: { effectRef: "burning", conditionRef: "burning" }
  };
  assert.throws(() => prepareItemBundle(conflicting, "world.items"), /exactly one reference field/);

  const parsedUnsupported = parseItemBundle(bundle());
  parsedUnsupported.documents.sword.type = "not-a-gum-item";
  assert.throws(() => prepareItemBundle(parsedUnsupported, "world.items"), /unsupported Item type/);

  const invalidId = bundle();
  invalidId.documents.burning._id = "not-a-foundry-id";
  assert.throws(() => prepareItemBundle(invalidId, "world.items"), /invalid _id/);
});

test("previews repeat imports and refuses deterministic ID collisions", () => {
  const prepared = prepareItemBundle(bundle(), "world.items");
  const [dependency, modifier, root] = prepared.documents;
  const preview = previewItemBundleSynchronization([
    { id: dependency.data._id, flags: { gum: { itemBundle: { id: prepared.id, key: dependency.key } } } },
    { id: modifier.data._id, name: "Unrelated item" }
  ], prepared);

  assert.equal(preview.updates, 1);
  assert.equal(preview.creates, 1);
  assert.deepEqual(preview.collisions, [{ key: modifier.key, id: modifier.data._id, existingName: "Unrelated item" }]);
  assert.ok(root.root);
});
