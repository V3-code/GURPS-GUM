import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";

import { BODY_PROFILES, getBodyProfile, getBodyProfileLocationKeys } from "../module/config/body-profiles.js";

const importerSource = readFileSync(new URL("../module/apps/importers.js", import.meta.url), "utf8");
const actorSheetSource = readFileSync(new URL("../module/actor/gurps-actor-sheet.js", import.meta.url), "utf8");
const actorPreparationSource = readFileSync(new URL("../scripts/main.js", import.meta.url), "utf8");
const damageApplicationSource = readFileSync(new URL("../scripts/apps/damage-application.js", import.meta.url), "utf8");

const mappingStart = importerSource.indexOf("const GCS_ALL_DR_KEY");
const mappingEnd = importerSource.indexOf("function getGCSFeatureAmount", mappingStart);
const mappingContext = vm.createContext({ getBodyProfile });
vm.runInContext(`${importerSource.slice(mappingStart, mappingEnd)}
this.inferProfile = inferGUMBodyProfileIdFromGCS;
this.resolveLocations = getGUMBodyLocationKeysForGCS;`, mappingContext);

test("body profile location keys never include locations left by another profile", () => {
  for (const [profileId, profile] of Object.entries(BODY_PROFILES)) {
    const keys = getBodyProfileLocationKeys(profileId);
    assert.deepEqual(keys, [...new Set(profile.order)], `${profileId} must keep its configured order`);
    assert.ok(keys.every(key => Object.hasOwn(profile.locations, key)), `${profileId} contains a foreign location`);
  }
  assert.deepEqual(
    getBodyProfileLocationKeys("humanoid"),
    getBodyProfile("humanoid").order,
  );
  assert.deepEqual(
    getBodyProfileLocationKeys("quadruped"),
    getBodyProfile("quadruped").order,
  );
  assert.equal(getBodyProfileLocationKeys("humanoid").includes("leg_l_1"), false);
  assert.equal(getBodyProfileLocationKeys("quadruped").includes("leg_l"), false);
});

test("DR consumers use one effective location set without reviving stale profile data", () => {
  assert.match(actorPreparationSource, /buildEffectiveBodyLocations\(\{/);
  assert.match(actorPreparationSource, /const locationKeys = effectiveBodyLocations\.order/);
  assert.doesNotMatch(actorPreparationSource, /extraLocationKeys/);
  assert.match(actorSheetSource, /effectiveBodyLocations\.definitions/);
  assert.match(actorSheetSource, /const locationOrder = effectiveBodyLocations\?\.order/);
  assert.match(damageApplicationSource, /effectiveLocations\?\.order/);
  assert.match(actorSheetSource, /system\.combat\.additional_locations\.\-=\$\{key\}/);
  assert.match(actorSheetSource, /name="location" list="gum-rd-location-suggestions"/);
  assert.doesNotMatch(actorSheetSource, /name="preset"/);
});

test("GCS anatomy resolves only to locations belonging to the selected profile", () => {
  assert.deepEqual(Array.from(mappingContext.resolveLocations("left_leg", "humanoid")), ["leg_l"]);
  assert.deepEqual(Array.from(mappingContext.resolveLocations("left_leg", "quadruped")), ["leg_l_1", "leg_l_2"]);
  assert.deepEqual(Array.from(mappingContext.resolveLocations("leg_1", "quadruped")), ["leg_l_1", "leg_r_1"]);
  assert.deepEqual(Array.from(mappingContext.resolveLocations("foreleg", "quadruped")), ["leg_l_1", "leg_r_1"]);
  assert.deepEqual(Array.from(mappingContext.resolveLocations("hind-foot", "quadruped")), ["foot_l_2", "foot_r_2"]);
  assert.deepEqual(Array.from(mappingContext.resolveLocations("legs", "quadruped")), ["leg_l_1", "leg_r_1", "leg_l_2", "leg_r_2"]);
  assert.deepEqual(Array.from(mappingContext.resolveLocations("tail_1", "humanoid")), []);
});

test("GCS body type selects the matching GUM profile and is propagated to armor imports", () => {
  assert.equal(mappingContext.inferProfile({ id: "quadruped", name: "Quadruped" }), "quadruped");
  assert.equal(mappingContext.inferProfile({ name: "Aracnídeo" }), "arachnid");
  assert.equal(mappingContext.inferProfile({ id: "unknown-custom-profile" }), "humanoid");
  assert.equal(mappingContext.inferProfile({ id: "unknown-custom-profile" }, "hexapod"), "hexapod");
  assert.match(importerSource, /systemData\.combat\.body_profile = bodyProfileId/);
  assert.match(importerSource, /buildGCSCharacterInventoryItems\(gcsData, bodyProfileId\)/);
  assert.match(importerSource, /parseGCSLibraryEquipment\(source, \{ bodyProfileId \}\)/);
  assert.match(importerSource, /fallbackBodyProfileId: actor\.system\.combat\?\.body_profile \|\| "humanoid"/);
});
