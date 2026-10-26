export const MOVEMENT_RULER_SETTING = "movementRulerEnabled";

export const MOVEMENT_ACTION_ATTRIBUTES = Object.freeze({
  walk: "basic_move",
  fly: "air_move",
  swim: "water_move",
  burrow: "burrow_move",
  blink: "teleport_range"
});

export const MOVEMENT_BAND_COLORS = Object.freeze({
  available: 0x4CAF50,
  warning: 0xE6B94A,
  exceeded: 0xD64545
});

const SPECIAL_MOVEMENT_ACTIONS = new Set(["fly", "swim", "burrow", "blink"]);
const WARNING_RATIO = 0.75;

function finiteNumber(value, fallback = null) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round((finiteNumber(value, 0) + Number.EPSILON) * factor) / factor;
}

export function resolveMovementAllowance(tokenOrActor, action) {
  const attributeKey = MOVEMENT_ACTION_ATTRIBUTES[action];
  if (!attributeKey) return null;

  const actor = tokenOrActor?.actor ?? tokenOrActor;
  const attribute = actor?.system?.attributes?.[attributeKey];
  if (!attribute) return null;
  if (SPECIAL_MOVEMENT_ACTIONS.has(action) && attribute.enabled !== true) return null;

  const allowance = finiteNumber(attribute.final);
  if (allowance === null || allowance < 0) return null;
  return { action, attributeKey, allowance };
}

export function normalizeMovementCost(cost, gridDistance = 1) {
  const numericCost = finiteNumber(cost);
  const numericGridDistance = finiteNumber(gridDistance, 1);
  if (numericCost === null) return null;
  return round(numericCost / (numericGridDistance > 0 ? numericGridDistance : 1));
}

export function resolveMovementBand(spent, allowance, warningRatio = WARNING_RATIO) {
  const numericSpent = finiteNumber(spent);
  const numericAllowance = finiteNumber(allowance);
  if (numericSpent === null || numericAllowance === null || numericAllowance < 0) return "unavailable";
  if (numericSpent > numericAllowance) return "exceeded";
  if (numericAllowance > 0 && numericSpent >= numericAllowance * warningRatio) return "warning";
  return "available";
}

export function buildMovementState({ token, waypoint, gridDistance = 1 } = {}) {
  const budget = resolveMovementAllowance(token, waypoint?.action);
  if (!budget) return null;

  const spent = waypoint?.action === "blink"
    ? round(waypoint?.measurement?.backward?.distance ?? waypoint?.cost ?? 0)
    : normalizeMovementCost(waypoint?.measurement?.cost, gridDistance);
  if (spent === null) return null;
  const band = resolveMovementBand(spent, budget.allowance);
  return {
    ...budget,
    spent,
    band,
    color: MOVEMENT_BAND_COLORS[band] ?? null
  };
}

export function resolveJumpLimits(tokenOrActor) {
  const actor = tokenOrActor?.actor ?? tokenOrActor;
  const attributes = actor?.system?.attributes;
  if (!attributes) return null;
  const limits = {
    horizontalStanding: finiteNumber(attributes.jump_horizontal_standing?.final),
    horizontalRunning: finiteNumber(attributes.jump_horizontal_running?.final),
    verticalStanding: finiteNumber(attributes.jump_vertical_standing?.final),
    verticalRunning: finiteNumber(attributes.jump_vertical_running?.final)
  };
  return Object.values(limits).every(value => value !== null && value >= 0) ? limits : null;
}

export function buildJumpState({ token, horizontal = 0, vertical = 0 } = {}) {
  const limits = resolveJumpLimits(token);
  if (!limits) return null;
  const usedHorizontal = Math.max(0, finiteNumber(horizontal, 0));
  const usedVertical = Math.max(0, finiteNumber(vertical, 0));
  const withinStanding = usedHorizontal <= limits.horizontalStanding && usedVertical <= limits.verticalStanding;
  const withinRunning = usedHorizontal <= limits.horizontalRunning && usedVertical <= limits.verticalRunning;
  const mode = withinStanding ? "standing" : withinRunning ? "running" : "exceeded";
  const band = mode === "standing" ? "available" : mode === "running" ? "warning" : "exceeded";
  return {
    ...limits,
    horizontal: round(usedHorizontal),
    vertical: round(usedVertical),
    mode,
    band,
    labelKey: `GUM.CanvasJump.${mode[0].toUpperCase()}${mode.slice(1)}`,
    color: MOVEMENT_BAND_COLORS[band]
  };
}

function movementRulerEnabled() {
  try {
    return globalThis.game?.settings?.get?.("gum", MOVEMENT_RULER_SETTING) === true;
  } catch (_error) {
    return false;
  }
}

function sceneGridDistance() {
  return finiteNumber(globalThis.canvas?.scene?.grid?.distance,
    finiteNumber(globalThis.canvas?.dimensions?.distance, 1));
}

function formatBudgetNumber(value) {
  const numeric = finiteNumber(value, 0);
  return numeric.toLocaleString(globalThis.game?.i18n?.lang || undefined, {
    maximumFractionDigits: 2
  });
}

function measureHorizontalSegment(waypoint) {
  const previous = waypoint?.previous;
  if (!previous?.center || !waypoint?.center) return 0;
  try {
    const measurement = globalThis.canvas?.grid?.measurePath?.([
      { x: previous.center.x, y: previous.center.y, elevation: 0 },
      { x: waypoint.center.x, y: waypoint.center.y, elevation: 0 }
    ]);
    const distance = finiteNumber(measurement?.waypoints?.at?.(-1)?.distance,
      finiteNumber(measurement?.distance));
    if (distance !== null) return Math.max(0, distance);
  } catch (_error) {
    // Fall through to the measured 3D segment approximation.
  }
  const total = finiteNumber(waypoint?.measurement?.backward?.distance, 0);
  const elevation = Math.abs(finiteNumber(waypoint.elevation, 0) - finiteNumber(previous.elevation, 0));
  return Math.sqrt(Math.max(0, (total ** 2) - (elevation ** 2)));
}

function configureMovementActionAvailability(config) {
  const actions = config?.Token?.movement?.actions;
  if (!actions) return;

  for (const action of SPECIAL_MOVEMENT_ACTIONS) {
    const descriptor = actions[action];
    if (!descriptor || descriptor.gumMovementAvailability) continue;
    const originalCanSelect = descriptor.canSelect;
    descriptor.canSelect = token => {
      if (typeof originalCanSelect === "function" && !originalCanSelect(token)) return false;
      if (originalCanSelect === false) return false;
      if (!movementRulerEnabled()) return true;
      return resolveMovementAllowance(token, action) !== null;
    };
    descriptor.gumMovementAvailability = true;
  }
}

export function registerMovementRulerIntegration(config, { generation } = {}) {
  if (finiteNumber(generation, 0) < 13) return false;

  const BaseRuler = config?.Token?.rulerClass;
  const prototype = BaseRuler?.prototype;
  if (!prototype
    || typeof prototype._preparePath !== "function"
    || typeof prototype._getSegmentStyle !== "function"
    || typeof prototype._getGridHighlightStyle !== "function"
    || typeof prototype._getWaypointLabelContext !== "function") return false;

  if (BaseRuler.gumMovementRuler === true) return true;
  configureMovementActionAvailability(config);

  class GumMovementTokenRuler extends BaseRuler {
    static WAYPOINT_LABEL_TEMPLATE = "systems/gum/templates/hud/movement-waypoint-label.hbs";
    static gumMovementRuler = true;

    _gumMovementState(waypoint) {
      if (!movementRulerEnabled()) return null;
      return buildMovementState({
        token: this.token,
        waypoint,
        gridDistance: sceneGridDistance()
      });
    }

    _gumJumpState(waypoint) {
      return movementRulerEnabled() ? waypoint?._gumJumpState ?? null : null;
    }

    _preparePath(path) {
      super._preparePath(path);
      let horizontal = 0;
      let peakVertical = 0;
      let originElevation = 0;
      let jumping = false;
      for (const waypoint of path) {
        if (waypoint.action !== "jump") {
          jumping = false;
          continue;
        }
        if (!jumping || waypoint.previous?.action !== "jump") {
          horizontal = 0;
          peakVertical = 0;
          originElevation = finiteNumber(waypoint.previous?.elevation, finiteNumber(waypoint.elevation, 0));
          jumping = true;
        }
        horizontal += measureHorizontalSegment(waypoint);
        peakVertical = Math.max(peakVertical, finiteNumber(waypoint.elevation, 0) - originElevation);
        waypoint._gumJumpState = buildJumpState({ token: this.token, horizontal, vertical: peakVertical });
      }
    }

    _getSegmentStyle(waypoint) {
      const style = super._getSegmentStyle(waypoint);
      const movement = this._gumMovementState(waypoint);
      const jump = this._gumJumpState(waypoint);
      const color = jump?.color ?? movement?.color;
      return color === null || color === undefined ? style : { ...style, color };
    }

    _getGridHighlightStyle(waypoint, offset) {
      const style = super._getGridHighlightStyle(waypoint, offset);
      const movement = this._gumMovementState(waypoint);
      const jump = this._gumJumpState(waypoint);
      const color = jump?.color ?? movement?.color;
      return color === null || color === undefined ? style : { ...style, color };
    }

    _getWaypointLabelContext(waypoint, state) {
      const context = super._getWaypointLabelContext(waypoint, state);
      if (!context) return context;

      const movement = this._gumMovementState(waypoint);
      if (movement) {
        context.gumMovement = {
          ...movement,
          spentLabel: formatBudgetNumber(movement.spent),
          allowanceLabel: formatBudgetNumber(movement.allowance)
        };
        context.cssClass = `${context.cssClass || ""} gum-movement-${movement.band}`.trim();
      }
      const jump = this._gumJumpState(waypoint);
      if (jump) {
        context.cost = null;
        context.gumJump = {
          ...jump,
          horizontalLabel: formatBudgetNumber(jump.horizontal),
          verticalLabel: formatBudgetNumber(jump.vertical),
          horizontalStandingLabel: formatBudgetNumber(jump.horizontalStanding),
          horizontalRunningLabel: formatBudgetNumber(jump.horizontalRunning),
          verticalStandingLabel: formatBudgetNumber(jump.verticalStanding),
          verticalRunningLabel: formatBudgetNumber(jump.verticalRunning)
        };
        context.cssClass = `${context.cssClass || ""} gum-jump-${jump.band}`.trim();
      }
      return context;
    }
  }

  config.Token.rulerClass = GumMovementTokenRuler;
  return true;
}
