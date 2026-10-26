import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  buildJumpState,
  buildMovementState,
  normalizeMovementCost,
  registerMovementRulerIntegration,
  resolveMovementAllowance,
  resolveMovementBand
} from "../module/canvas/movement-ruler.mjs";

const actor = {
  system: {
    attributes: {
      basic_move: { final: 6 },
      air_move: { enabled: true, final: 10 },
      water_move: { enabled: false, final: 4 },
      burrow_move: { enabled: true, final: 2 },
      teleport_range: { enabled: true, final: 12 }
    }
  }
};

test("resolve o deslocamento final da ação, incluindo perfis especiais habilitados", () => {
  assert.deepEqual(resolveMovementAllowance(actor, "walk"), {
    action: "walk", attributeKey: "basic_move", allowance: 6
  });
  assert.deepEqual(resolveMovementAllowance({ actor }, "fly"), {
    action: "fly", attributeKey: "air_move", allowance: 10
  });
  assert.equal(resolveMovementAllowance(actor, "swim"), null);
  assert.equal(resolveMovementAllowance(actor, "climb"), null);
  assert.deepEqual(resolveMovementAllowance(actor, "blink"), {
    action: "blink", attributeKey: "teleport_range", allowance: 12
  });
});

test("normaliza o custo nativo pela escala da grade", () => {
  assert.equal(normalizeMovementCost(12, 2), 6);
  assert.equal(normalizeMovementCost(4.5, 1), 4.5);
});

test("classifica as faixas sem transformar o aviso em uma nova regra", () => {
  assert.equal(resolveMovementBand(4, 6), "available");
  assert.equal(resolveMovementBand(4.5, 6), "warning");
  assert.equal(resolveMovementBand(6, 6), "warning");
  assert.equal(resolveMovementBand(6.01, 6), "exceeded");
});

test("usa o custo acumulado medido pelo Foundry", () => {
  const state = buildMovementState({
    token: { actor },
    waypoint: { action: "walk", measurement: { cost: 5 } },
    gridDistance: 1
  });
  assert.equal(state.spent, 5);
  assert.equal(state.allowance, 6);
  assert.equal(state.band, "warning");
});

test("teletransporte compara cada segmento ao alcance final sem acumular deslocamento", () => {
  const state = buildMovementState({
    token: { actor },
    waypoint: { action: "blink", cost: 40, measurement: { cost: 40, backward: { distance: 9 } } },
    gridDistance: 2
  });
  assert.equal(state.spent, 9);
  assert.equal(state.allowance, 12);
  assert.equal(state.band, "warning");
});

test("salto distingue sem impulso, com impulso e valor excedido", () => {
  const jumpActor = { system: { attributes: {
    jump_horizontal_standing: { final: 2 },
    jump_horizontal_running: { final: 4 },
    jump_vertical_standing: { final: 0.5 },
    jump_vertical_running: { final: 1 }
  } } };
  assert.equal(buildJumpState({ token: jumpActor, horizontal: 1.5, vertical: 0.4 }).mode, "standing");
  assert.equal(buildJumpState({ token: jumpActor, horizontal: 3, vertical: 0.8 }).mode, "running");
  assert.equal(buildJumpState({ token: jumpActor, horizontal: 5, vertical: 0.8 }).mode, "exceeded");
});

test("registra a extensão somente quando a API compatível está disponível", () => {
  class CompatibleRuler {
    _preparePath() {}
    _getSegmentStyle() { return { color: 1 }; }
    _getGridHighlightStyle() { return { color: 1 }; }
    _getWaypointLabelContext() { return {}; }
  }
  const compatible = { Token: { rulerClass: CompatibleRuler, movement: { actions: {} } } };
  assert.equal(registerMovementRulerIntegration(compatible, { generation: 14 }), true);
  assert.notEqual(compatible.Token.rulerClass, CompatibleRuler);
  assert.equal(compatible.Token.rulerClass.gumMovementRuler, true);

  const legacy = { Token: { rulerClass: class {} } };
  assert.equal(registerMovementRulerIntegration(legacy, { generation: 12 }), false);
});

test("a extensão colore caminho, destaque e etiqueta sem alterar a medição", () => {
  const previousGame = globalThis.game;
  const previousCanvas = globalThis.canvas;
  globalThis.game = {
    settings: { get: () => true },
    i18n: { lang: "pt-BR" }
  };
  globalThis.canvas = { scene: { grid: { distance: 1 } }, dimensions: { distance: 1 } };

  class CompatibleRuler {
    _preparePath() {}
    _getSegmentStyle() { return { width: 4, color: 0x123456, alpha: 1 }; }
    _getGridHighlightStyle() { return { color: 0x123456, alpha: 0.5 }; }
    _getWaypointLabelContext() { return { cssClass: "planned" }; }
  }
  const config = {
    Token: {
      rulerClass: CompatibleRuler,
      movement: { actions: { fly: { canSelect: true }, swim: { canSelect: true }, burrow: { canSelect: true } } }
    }
  };
  registerMovementRulerIntegration(config, { generation: 14 });
  const ruler = new config.Token.rulerClass();
  ruler.token = { actor };
  const waypoint = { action: "walk", measurement: { cost: 7 } };

  assert.equal(ruler._getSegmentStyle(waypoint).color, 0xD64545);
  assert.equal(ruler._getGridHighlightStyle(waypoint, {}).color, 0xD64545);
  assert.equal(ruler._getWaypointLabelContext(waypoint, {}).gumMovement.allowance, 6);
  assert.equal(config.Token.movement.actions.fly.canSelect({ actor }), true);
  assert.equal(config.Token.movement.actions.swim.canSelect({ actor }), false);

  globalThis.game = previousGame;
  globalThis.canvas = previousCanvas;
});

test("a ação nativa de salto recebe um estado curto e usa a distância geométrica", () => {
  const previousGame = globalThis.game;
  const previousCanvas = globalThis.canvas;
  globalThis.game = { settings: { get: () => true }, i18n: { lang: "pt-BR" } };
  globalThis.canvas = {
    scene: { grid: { distance: 1 } },
    dimensions: { distance: 1 },
    grid: { measurePath: () => ({ waypoints: [{ distance: 0 }, { distance: 3 }] }) }
  };
  const jumpActor = { system: { attributes: {
    jump_horizontal_standing: { final: 2 }, jump_horizontal_running: { final: 4 },
    jump_vertical_standing: { final: 0.5 }, jump_vertical_running: { final: 1 }
  } } };
  class CompatibleRuler {
    _preparePath() {}
    _getSegmentStyle() { return { color: 1 }; }
    _getGridHighlightStyle() { return { color: 1 }; }
    _getWaypointLabelContext() { return { cssClass: "planned", cost: {}, distance: { total: "3" } }; }
  }
  const config = { Token: { rulerClass: CompatibleRuler, movement: { actions: {} } } };
  registerMovementRulerIntegration(config, { generation: 14 });
  const ruler = new config.Token.rulerClass();
  ruler.token = { actor: jumpActor };
  const first = { action: "jump", center: { x: 0, y: 0 }, elevation: 0, measurement: { backward: { distance: 0 } }, previous: null };
  const second = { action: "jump", center: { x: 3, y: 0 }, elevation: 0, measurement: { backward: { distance: 3 } }, previous: first };
  first.next = second;
  ruler._preparePath([first, second]);
  const context = ruler._getWaypointLabelContext(second, {});
  assert.equal(context.cost, null);
  assert.equal(context.gumJump.mode, "running");
  assert.equal(context.gumJump.horizontal, 3);
  assert.equal(ruler._getSegmentStyle(second).color, 0xE6B94A);
  globalThis.game = previousGame;
  globalThis.canvas = previousCanvas;
});

test("integra configuração, inicialização, template e traduções", () => {
  const main = fs.readFileSync(new URL("../scripts/main.js", import.meta.url), "utf8");
  const settings = fs.readFileSync(new URL("../module/settings.js", import.meta.url), "utf8");
  const template = fs.readFileSync(new URL("../templates/hud/movement-waypoint-label.hbs", import.meta.url), "utf8");
  const pt = JSON.parse(fs.readFileSync(new URL("../lang/pt-BR.json", import.meta.url), "utf8"));
  const en = JSON.parse(fs.readFileSync(new URL("../lang/en.json", import.meta.url), "utf8"));

  assert.match(main, /registerMovementRulerIntegration\(CONFIG/);
  assert.match(settings, /MOVEMENT_RULER_SETTING[\s\S]*?scope:\s*"world"[\s\S]*?default:\s*false/);
  assert.match(template, /gum-movement-budget/);
  for (const key of ["GUM.Settings.MovementRuler.Name", "GUM.Settings.MovementRuler.Hint", "GUM.CanvasMovement.BudgetTooltip"]) {
    assert.equal(typeof pt[key], "string", `missing pt-BR key ${key}`);
    assert.equal(typeof en[key], "string", `missing en key ${key}`);
  }
});
