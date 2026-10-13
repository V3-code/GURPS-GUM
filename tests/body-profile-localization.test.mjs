import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BODY_PROFILES,
  EXTRA_BODY_LOCATIONS,
  localizeBodyGroupLabel,
  localizeBodyLocationLabel,
  localizeBodyProfileLabel,
} from "../module/config/body-profiles.js";

const locales = {
  en: JSON.parse(readFileSync(new URL("../lang/en.json", import.meta.url), "utf8")),
  pt: JSON.parse(readFileSync(new URL("../lang/pt-BR.json", import.meta.url), "utf8")),
};
const actorSheet = readFileSync(new URL("../module/actor/gurps-actor-sheet.js", import.meta.url), "utf8");
const damageApplication = readFileSync(new URL("../scripts/apps/damage-application.js", import.meta.url), "utf8");
const translator = dictionary => key => dictionary[key] ?? key;

test("body profiles and hit locations localize their semantic labels", () => {
  assert.equal(localizeBodyProfileLabel(BODY_PROFILES.humanoid, translator(locales.en)), "Humanoid (default)");
  assert.equal(localizeBodyProfileLabel(BODY_PROFILES.humanoid, translator(locales.pt)), "Humanoide (padrão)");
  assert.equal(localizeBodyLocationLabel("head", BODY_PROFILES.humanoid.locations.head, translator(locales.en)), "Skull");
  assert.equal(localizeBodyLocationLabel("arm_l", BODY_PROFILES.humanoid.locations.arm_l, translator(locales.en)), "Arm L1");
  assert.equal(localizeBodyLocationLabel("arm_l", BODY_PROFILES.humanoid.locations.arm_l, translator(locales.pt)), "Braço E1");
  assert.equal(localizeBodyLocationLabel("arm_1", EXTRA_BODY_LOCATIONS.arm_1, translator(locales.en)), "Extra Arm 1");
  assert.equal(localizeBodyGroupLabel("arm", "Braços", translator(locales.en)), "Arms");
});

test("every configured profile and body-part family has English and Portuguese copy", () => {
  const allLocations = [
    ...Object.values(BODY_PROFILES).flatMap(profile => Object.entries(profile.locations || {})),
    ...Object.entries(EXTRA_BODY_LOCATIONS),
  ];
  const partIds = new Set(allLocations.map(([locationId]) => locationId.split("_")[0]));

  for (const profile of Object.values(BODY_PROFILES)) {
    const key = `GUM.Combat.DR.Profiles.${profile.id}`;
    assert.equal(typeof locales.en[key], "string", `missing English ${key}`);
    assert.equal(typeof locales.pt[key], "string", `missing Portuguese ${key}`);
  }
  for (const partId of partIds) {
    const key = `GUM.Combat.DR.BodyParts.${partId}`;
    assert.equal(typeof locales.en[key], "string", `missing English ${key}`);
    assert.equal(typeof locales.pt[key], "string", `missing Portuguese ${key}`);
  }
  for (const groupId of new Set(allLocations.map(([, location]) => location.groupKey).filter(Boolean))) {
    const key = `GUM.Combat.DR.BodyPartPlurals.${groupId}`;
    assert.equal(typeof locales.en[key], "string", `missing English ${key}`);
    assert.equal(typeof locales.pt[key], "string", `missing Portuguese ${key}`);
  }
});

test("non-humanoid locations retain their family, side, and ordinal in both locales", () => {
  const cases = [
    ["quadruped", "leg_l_2", "Leg L2", "Perna E2"],
    ["hexapod", "foot_r_3", "Foot R3", "Pé D3"],
    ["avian", "wing_l_1", "Wing L1", "Asa E1"],
    ["octopod", "tentacle_r_4", "Tentacle R4", "Tentáculo D4"],
    ["cancroid", "pincer_l_1", "Pincer L1", "Pinça E1"],
    ["ichthyoid", "fin_r_1", "Fin R1", "Nadadeira D1"],
    ["arachnid", "paw_l_4", "Paw L4", "Pata E4"],
  ];

  for (const [profileId, locationId, english, portuguese] of cases) {
    const location = BODY_PROFILES[profileId].locations[locationId];
    assert.equal(localizeBodyLocationLabel(locationId, location, translator(locales.en)), english);
    assert.equal(localizeBodyLocationLabel(locationId, location, translator(locales.pt)), portuguese);
  }
});

test("the DR editor uses localized profiles, locations, field labels, and actions", () => {
  assert.match(actorSheet, /localizeBodyProfileLabel\(p, t\)/);
  assert.match(actorSheet, /localizeBodyLocationLabel\(key, loc, t\)/);
  assert.match(actorSheet, /GUM\.Combat\.DR\.ManualFor/);
  assert.match(actorSheet, /GUM\.Combat\.DR\.Cancel/);
  assert.doesNotMatch(actorSheet.slice(actorSheet.indexOf("async _onViewHitLocations"), actorSheet.indexOf("async _onEditWound")), /label: t\("GUM\.Skills\.Cancel"\)/);
});

test("damage application and character DR rows share localized labels and collapse only equal DR", () => {
  assert.match(damageApplication, /localizeBodyLocationLabel\(key, data, localizationKey => game\.i18n\.localize\(localizationKey\)\)/);
  assert.match(damageApplication, /const isUniform = groupItems\.every\(member => member\.drSignature === signature\)/);
  assert.match(actorSheet, /const isUniform = groupItems\.every\(member => member\.drSignature === signature\)/);
  assert.match(actorSheet, /const rawDR = drLocations\?\.\[key\];[\s\S]*?\{ base: Number\(rawDR\) \|\| 0 \}/);
});
