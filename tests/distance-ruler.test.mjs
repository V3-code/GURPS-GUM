import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildDistanceModifierState, registerDistanceRulerIntegration } from "../module/canvas/distance-ruler.mjs";

test("calcula o modificador a partir da distância acumulada da régua", () => {
  assert.deepEqual(buildDistanceModifierState({ measurement: { distance: 20 } }, "standard"), {
    distance: 20,
    modifier: -6,
    label: "−6",
    tableKey: "standard"
  });
});

test("acrescenta o modificador ao contexto sem alterar a régua nativa", () => {
  const previousGame = globalThis.game;
  globalThis.game = {
    settings: {
      get: (_namespace, key) => key === "autoDistanceModifierEnabled" ? true : "hybrid"
    }
  };

  class CompatibleRuler {
    _getWaypointLabelContext() {
      return { distance: { total: "15" }, units: "m", cssClass: "last" };
    }
  }
  const config = { Canvas: { rulerClass: CompatibleRuler } };
  assert.equal(registerDistanceRulerIntegration(config, { generation: 14 }), true);
  const context = new config.Canvas.rulerClass()._getWaypointLabelContext({ measurement: { distance: 15 } }, {});
  assert.equal(context.distance.total, "15");
  assert.equal(context.gumDistanceModifier.label, "−5");
  globalThis.game = previousGame;
});

test("mantém compatibilidade defensiva e integra o separador visual", () => {
  const main = fs.readFileSync(new URL("../scripts/main.js", import.meta.url), "utf8");
  const prompt = fs.readFileSync(new URL("../module/apps/roll-prompt.js", import.meta.url), "utf8");
  const template = fs.readFileSync(new URL("../templates/hud/movement-waypoint-label.hbs", import.meta.url), "utf8");

  assert.equal(registerDistanceRulerIntegration({ Canvas: { rulerClass: class {} } }, { generation: 12 }), false);
  assert.match(main, /registerDistanceRulerIntegration\(CONFIG/);
  assert.match(prompt, /getDistanceModifier\(distanceMeters, selectedTable\)/);
  assert.match(template, /gum-distance-separator[^>]*>\|</);
});
