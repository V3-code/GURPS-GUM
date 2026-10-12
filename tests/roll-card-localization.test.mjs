import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { listBodyLocations } from "../module/config/body-profiles.js";
import { bilingualLocationOptions, englishEquipmentLocationName } from "../module/utils/equipment-location-aliases.mjs";

const english = JSON.parse(readFileSync(new URL("../lang/en.json", import.meta.url)));
const portuguese = JSON.parse(readFileSync(new URL("../lang/pt-BR.json", import.meta.url)));

test("roll card labels have both English and Portuguese translations", () => {
  for (const key of [
    "Dice", "Target", "TotalDamage", "SkillLevel", "Cap", "Final", "Purposes",
    "RollDamage", "ApplyToTarget", "BasicDamage", "ResistanceTest", "CommandDamage",
    "Outcome.success", "Outcome.failure", "Outcome.critical-success", "Outcome.critical-failure"
  ]) {
    assert.ok(english[`GUM.RollCard.${key}`], `English: ${key}`);
    assert.ok(portuguese[`GUM.RollCard.${key}`], `Portuguese: ${key}`);
  }
});

test("equipment protection offers Portuguese and English names for the same location", () => {
  const original = listBodyLocations();
  assert.ok(original.every(option => englishEquipmentLocationName(option.name) !== option.name));
  const englishDisplay = original.map(option => ({ ...option, name: englishEquipmentLocationName(option.name) }));
  const inPortuguese = bilingualLocationOptions(original, original, "pt-BR");
  const inEnglish = bilingualLocationOptions(original, englishDisplay, "en");
  const arm = original.find(option => option.name.startsWith("Braço E1"));
  assert.ok(arm);
  assert.deepEqual(inPortuguese.filter(option => option.id === arm.id).map(option => option.name), ["Braço E1", "Arm L1"]);
  assert.deepEqual(inEnglish.filter(option => option.id === arm.id).map(option => option.name), ["Arm L1", "Braço E1"]);
  assert.equal(englishEquipmentLocationName("Órg. Vitais"), "Vitals");
});
