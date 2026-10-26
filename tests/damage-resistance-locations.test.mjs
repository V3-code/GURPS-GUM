import assert from "node:assert/strict";
import test from "node:test";

import { getBodyProfile } from "../module/config/body-profiles.js";
import { buildEffectiveBodyLocations, describeBodyLocationSources } from "../module/utils/damage-resistance-locations.mjs";

const equipment = ({ id = "armor", name = "Armadura Alada", location = "equipped", dr = { wing_l_1: { base: 5 } }, options = {} } = {}) => ({
  id, name, type: "equipment", system: { location, dr_locations: dr, dr_location_options: options }
});

test("equipped legacy armor contributes a recognized location outside the body profile", () => {
  const result = buildEffectiveBodyLocations({ profile: getBodyProfile("humanoid"), equipment: [equipment()] });
  assert.equal(result.order.includes("wing_l_1"), true);
  assert.equal(result.definitions.wing_l_1.label, "Asa E1");
  assert.deepEqual(describeBodyLocationSources(result.sources.wing_l_1), ["Armadura Alada"]);
});

test("unequipped armor and disabled location providers do not alter anatomy", () => {
  const unequipped = buildEffectiveBodyLocations({ profile: "humanoid", equipment: [equipment({ location: "carried" })] });
  const disabled = buildEffectiveBodyLocations({
    profile: "humanoid",
    equipment: [equipment({ options: { wing_l_1: { provides_location: false } } })]
  });
  assert.equal(unequipped.order.includes("wing_l_1"), false);
  assert.equal(disabled.order.includes("wing_l_1"), false);
});

test("multiple equipped items remain traceable as sources for the same supplied location", () => {
  const result = buildEffectiveBodyLocations({
    profile: "humanoid",
    equipment: [equipment(), equipment({ id: "cloak", name: "Manto de Voo" })]
  });
  assert.deepEqual(describeBodyLocationSources(result.sources.wing_l_1), ["Armadura Alada", "Manto de Voo"]);
});

test("manual preset and custom locations persist independently from equipment", () => {
  const result = buildEffectiveBodyLocations({
    profile: "humanoid",
    additionalLocations: {
      tail_1: { label: "Cauda", roll: "14" },
      custom_core: { label: "Núcleo", roll: "--" }
    }
  });
  assert.equal(result.definitions.tail_1.label, "Cauda");
  assert.equal(result.definitions.custom_core.label, "Núcleo");
  assert.equal(result.definitions.custom_core.roll, "--");
  assert.equal(result.sources.custom_core[0].type, "manual");
});

test("unknown equipment keys never create unvalidated body locations", () => {
  const result = buildEffectiveBodyLocations({
    profile: "humanoid",
    equipment: [equipment({ dr: { "ASA digitada livremente": { base: 9 } } })]
  });
  assert.equal(result.order.includes("ASA digitada livremente"), false);
});
