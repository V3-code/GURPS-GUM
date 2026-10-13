import { clampFloatingPanelPosition } from "../utils/floating-panel-position.mjs";
import { buildHexOccupancyGroups } from "../utils/hex-occupancy.mjs";

export const HEX_OCCUPANCY_SETTING = "tacticalHexOccupancyEnabled";

const PICKER_ID = "gum-hex-occupancy-picker";

const tokenId = token => String(token?.id ?? token?.document?.id ?? "");
const tokenName = token => String(token?.name ?? token?.document?.name ?? token?.actor?.name ?? "");
const tokenImage = token => token?.document?.texture?.src ?? token?.texture?.src ?? token?.actor?.img ?? "icons/svg/mystery-man.svg";

function localize(key, fallback = key) {
  const value = globalThis.game?.i18n?.localize?.(key);
  return value && value !== key ? value : fallback;
}

function visibleToCurrentUser(token) {
  if (!token?.document || token.visible === false) return false;
  if (token.document.hidden && !globalThis.game?.user?.isGM) return false;
  return true;
}

export function canvasPointToViewport(scenePoint, canvas = globalThis.canvas) {
  if (!scenePoint) return null;

  // canvasPan is emitted after Foundry changes the stage pivot and scale, but
  // before PIXI refreshes worldTransform. Reading the transform at that point
  // leaves HTML overlays one camera update behind. These are the same affine
  // values used by Foundry's unrotated canvas stage, and they are current as
  // soon as canvasPan fires.
  const stage = canvas?.stage;
  const positionX = Number(stage?.position?.x);
  const positionY = Number(stage?.position?.y);
  const pivotX = Number(stage?.pivot?.x);
  const pivotY = Number(stage?.pivot?.y);
  const scaleX = Number(stage?.scale?.x);
  const scaleY = Number(stage?.scale?.y);
  const pointX = Number(scenePoint.x);
  const pointY = Number(scenePoint.y);
  if ([positionX, positionY, pivotX, pivotY, scaleX, scaleY, pointX, pointY].every(Number.isFinite)) {
    return {
      x: positionX + ((pointX - pivotX) * scaleX),
      y: positionY + ((pointY - pivotY) * scaleY)
    };
  }

  return canvas?.clientCoordinatesFromCanvas?.(scenePoint) ?? null;
}

export class HexOccupancyOverlay {
  constructor() {
    this.picker = null;
    this.groups = new Map();
    this.refreshFrame = null;
    this.openGroupKey = null;
    this.pickerManuallyPositioned = false;
    this.pickerMinimized = false;
    this.pickerDragCleanup = null;
    this._escapeHandler = event => {
      if (event.key === "Escape") this.closePicker();
    };
  }

  isEnabled() {
    try {
      return globalThis.game?.settings?.get?.("gum", HEX_OCCUPANCY_SETTING) === true;
    } catch (_error) {
      return false;
    }
  }

  scheduleRefresh() {
    if (this.refreshFrame !== null) return;
    const request = globalThis.requestAnimationFrame ?? (callback => setTimeout(callback, 0));
    this.refreshFrame = request(() => {
      this.refreshFrame = null;
      this.refresh();
    });
  }

  refresh() {
    const canvas = globalThis.canvas;
    if (!this.isEnabled() || !canvas?.ready || canvas.grid?.isHexagonal !== true) {
      this.destroy();
      return;
    }

    const groups = buildHexOccupancyGroups(canvas.tokens?.placeables ?? [], {
      grid: canvas.grid,
      tokenFilter: visibleToCurrentUser
    });
    this.groups = new Map(groups.map(group => [group.key, group]));
    this.renderMarkers(groups);
    if (this.openGroupKey) {
      const group = this.groups.get(this.openGroupKey);
      if (group) this.updatePickerGroup(group);
      else this.setPickerOccupancyEnded(true);
    }
  }

  renderMarkers(groups) {
    globalThis.canvas?.gumHexOccupancy?.renderGroups?.(groups, {
      onActivate: groupKey => this.openPicker(groupKey)
    });
  }

  openPicker(groupKey) {
    const group = this.groups.get(groupKey);
    if (!group) return;
    if (this.picker) {
      this.openGroupKey = groupKey;
      this.updatePickerGroup(group);
      this.setPickerMinimized(false);
      return;
    }
    this.openGroupKey = groupKey;

    const picker = document.createElement("section");
    picker.id = PICKER_ID;
    picker.className = "gum-hex-occupancy-picker";
    picker.setAttribute("role", "dialog");
    picker.setAttribute("aria-modal", "false");
    picker.setAttribute("aria-label", localize("GUM.HexOccupancy.PickerTitle", "Hex occupants"));

    const header = document.createElement("header");
    const title = document.createElement("strong");
    title.textContent = localize("GUM.HexOccupancy.PickerTitle", "Hex occupants");
    const headerActions = document.createElement("div");
    headerActions.className = "gum-hex-occupancy-window-actions";
    const minimize = document.createElement("button");
    minimize.type = "button";
    minimize.className = "gum-hex-occupancy-minimize";
    minimize.addEventListener("click", event => {
      event.stopPropagation();
      this.setPickerMinimized(!this.pickerMinimized);
    });
    const close = document.createElement("button");
    close.type = "button";
    close.className = "gum-hex-occupancy-close";
    close.title = localize("GUM.HexOccupancy.Close", "Close");
    close.setAttribute("aria-label", close.title);
    close.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
    close.addEventListener("click", () => this.closePicker());
    headerActions.append(minimize, close);
    header.append(title, headerActions);
    picker.append(header);
    this.makePickerDraggable(picker, header);

    const ended = document.createElement("p");
    ended.className = "gum-hex-occupancy-ended";
    ended.textContent = localize("GUM.HexOccupancy.Ended", "These tokens no longer share this occupied hex.");
    picker.append(ended);

    const list = document.createElement("div");
    list.className = "gum-hex-occupancy-list";
    picker.append(list);

    document.body.append(picker);
    this.picker = picker;
    this.pickerManuallyPositioned = false;
    this.pickerMinimized = false;
    this.updatePickerGroup(group);
    this.setPickerMinimized(false);
    this.positionPicker(picker, group.center);
    // From this point on the picker behaves like a detached Foundry window:
    // canvas pans do not pull it away from the screen position chosen at open.
    this.pickerManuallyPositioned = true;
    document.addEventListener("keydown", this._escapeHandler, true);
  }

  updatePickerGroup(group) {
    if (!this.picker || !group) return;
    const list = this.picker.querySelector(".gum-hex-occupancy-list");
    if (!list) return;
    list.replaceChildren(...group.tokens.map(token => this.buildTokenRow(token)));
    this.setPickerOccupancyEnded(false);
  }

  setPickerOccupancyEnded(ended) {
    if (!this.picker) return;
    this.picker.classList.toggle("is-ended", Boolean(ended));
  }

  setPickerMinimized(minimized) {
    if (!this.picker) return;
    this.pickerMinimized = Boolean(minimized);
    this.picker.classList.toggle("is-minimized", this.pickerMinimized);
    const button = this.picker.querySelector(".gum-hex-occupancy-minimize");
    if (!button) return;
    const key = this.pickerMinimized ? "GUM.HexOccupancy.Restore" : "GUM.HexOccupancy.Minimize";
    button.title = localize(key, this.pickerMinimized ? "Restore" : "Minimize");
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-expanded", String(!this.pickerMinimized));
    button.innerHTML = this.pickerMinimized
      ? '<i class="fas fa-window-maximize" aria-hidden="true"></i>'
      : '<i class="fas fa-window-minimize" aria-hidden="true"></i>';
  }

  positionPicker(picker, scenePoint) {
    const point = canvasPointToViewport(scenePoint);
    if (!point) return;
    this.positionPickerAt(picker, {
      left: point.x - picker.getBoundingClientRect().width / 2,
      top: point.y + 24
    });
  }

  positionPickerAt(picker, { left, top }) {
    const bounds = picker.getBoundingClientRect();
    const position = clampFloatingPanelPosition({
      left,
      top,
      width: bounds.width,
      height: bounds.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      margin: 8
    });
    picker.style.left = `${position.left}px`;
    picker.style.top = `${position.top}px`;
  }

  makePickerDraggable(picker, header) {
    header.addEventListener("pointerdown", event => {
      if (event.button !== 0 || event.target?.closest?.("button")) return;
      event.preventDefault();
      const start = picker.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const onMove = moveEvent => {
        this.pickerManuallyPositioned = true;
        this.positionPickerAt(picker, {
          left: start.left + moveEvent.clientX - startX,
          top: start.top + moveEvent.clientY - startY
        });
      };
      const stopDragging = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", stopDragging);
        document.removeEventListener("pointercancel", stopDragging);
        picker.classList.remove("is-dragging");
        this.pickerDragCleanup = null;
      };

      this.pickerDragCleanup?.();
      this.pickerDragCleanup = stopDragging;
      picker.classList.add("is-dragging");
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", stopDragging);
      document.addEventListener("pointercancel", stopDragging);
    });
  }

  buildTokenRow(token) {
    const row = document.createElement("article");
    row.className = "gum-hex-occupancy-token";
    row.dataset.tokenId = tokenId(token);

    const portrait = document.createElement("img");
    portrait.src = tokenImage(token);
    portrait.alt = "";
    const identity = document.createElement("div");
    identity.className = "gum-hex-occupancy-identity";
    const name = document.createElement("strong");
    name.textContent = tokenName(token) || localize("GUM.HexOccupancy.UnknownToken", "Token");
    identity.append(name, this.buildStatusStrip(token));

    const actions = document.createElement("div");
    actions.className = "gum-hex-occupancy-actions";
    actions.append(
      this.actionButton("control", "fa-mouse-pointer", "GUM.HexOccupancy.Control", event => this.controlToken(token, event), token.controlled),
      this.actionButton("target", "fa-bullseye", "GUM.HexOccupancy.Target", event => this.targetToken(token, event), globalThis.game?.user?.targets?.has?.(token)),
      this.actionButton("sheet", "fa-user", "GUM.HexOccupancy.OpenSheet", () => this.openActorSheet(token)),
      this.actionButton("configure", "fa-cog", "GUM.HexOccupancy.Configure", () => this.configureToken(token), false, !this.canConfigureToken(token))
    );

    row.append(portrait, identity, actions);
    return row;
  }

  buildStatusStrip(token) {
    const strip = document.createElement("div");
    strip.className = "gum-hex-occupancy-statuses";
    const effects = Array.from(token?.actor?.temporaryEffects ?? token?.actor?.effects ?? [])
      .filter(effect => !effect?.disabled && (effect?.img || effect?.icon))
      .slice(0, 4);
    for (const effect of effects) {
      const icon = document.createElement("img");
      icon.src = effect.img || effect.icon;
      icon.alt = "";
      icon.title = effect.name || "";
      strip.append(icon);
    }
    if (!effects.length) {
      const empty = document.createElement("span");
      empty.textContent = localize("GUM.HexOccupancy.NoVisibleStatuses", "No visible statuses");
      strip.append(empty);
    }
    return strip;
  }

  actionButton(action, icon, labelKey, handler, active = false, disabled = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.action = action;
    button.className = `gum-hex-occupancy-action${active ? " is-active" : ""}`;
    button.disabled = disabled;
    button.title = localize(labelKey, action);
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-pressed", String(Boolean(active)));
    button.innerHTML = `<i class="fas ${icon}" aria-hidden="true"></i>`;
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      handler(event);
    });
    return button;
  }

  controlToken(token, event) {
    if (token?.controlled) return;
    const controlled = token?.control?.({ releaseOthers: !event.shiftKey });
    if (controlled === false) globalThis.ui?.notifications?.warn?.(localize("GUM.HexOccupancy.ControlDenied", "You cannot control this token."));
    this.refreshPickerState();
  }

  targetToken(token, event) {
    const targeted = globalThis.game?.user?.targets?.has?.(token) === true;
    token?.setTarget?.(!targeted, { releaseOthers: !targeted && !event.shiftKey });
    this.refreshPickerState();
  }

  openActorSheet(token) {
    const actor = token?.actor;
    if (!actor?.visible) {
      globalThis.ui?.notifications?.warn?.(localize("GUM.HexOccupancy.SheetDenied", "You cannot open this actor sheet."));
      return;
    }
    actor.sheet?.render?.(true);
  }

  canConfigureToken(token) {
    return globalThis.game?.user?.isGM || token?.document?.isOwner === true || token?.document?.canUserModify?.(globalThis.game?.user, "update") === true;
  }

  configureToken(token) {
    if (!this.canConfigureToken(token)) return;
    token.document?.sheet?.render?.(true);
  }

  refreshPickerState() {
    if (!this.openGroupKey) return;
    const group = this.groups.get(this.openGroupKey);
    if (group) this.updatePickerGroup(group);
  }

  closePicker() {
    this.pickerDragCleanup?.();
    this.pickerDragCleanup = null;
    this.picker?.remove();
    this.picker = null;
    this.openGroupKey = null;
    this.pickerManuallyPositioned = false;
    this.pickerMinimized = false;
    document.removeEventListener("keydown", this._escapeHandler, true);
  }

  destroy() {
    this.closePicker();
    globalThis.canvas?.gumHexOccupancy?.clearMarkers?.();
    this.groups.clear();
  }
}

export const hexOccupancyOverlay = new HexOccupancyOverlay();

const OCCUPANCY_POSITION_FIELDS = new Set(["x", "y", "elevation", "width", "height", "shape", "hidden"]);

export function tokenUpdateAffectsHexOccupancy(changes = {}) {
  return Object.keys(changes ?? {}).some(key => OCCUPANCY_POSITION_FIELDS.has(key));
}

export function refreshHexOccupancyAfterTokenUpdate(tokenDocument, changes = {}, overlay = hexOccupancyOverlay) {
  // Foundry updates TokenDocument occupancy before the rendered Token completes
  // its movement animation. For animated positional changes, wait for the
  // visual movement to settle so a destination hex is not announced early.
  const movement = tokenDocument?.object?.movementAnimationPromise;
  if (tokenUpdateAffectsHexOccupancy(changes) && movement && typeof movement.then === "function") {
    void Promise.resolve(movement).then(
      () => overlay.scheduleRefresh(),
      () => overlay.scheduleRefresh()
    );
    return;
  }

  // Non-animated movement and presentation changes can be reflected at once.
  overlay.scheduleRefresh();
}

let hooksRegistered = false;

export function registerHexOccupancyCanvasHooks(hooks = globalThis.Hooks) {
  if (hooksRegistered || !hooks?.on) return;
  hooksRegistered = true;
  hooks.on("canvasReady", () => hexOccupancyOverlay.scheduleRefresh());
  hooks.on("canvasTearDown", () => hexOccupancyOverlay.destroy());
  hooks.on("canvasPan", (canvas, position) => {
    canvas?.gumHexOccupancy?.syncMarkerScale?.(position?.scale);
  });
  hooks.on("createToken", () => hexOccupancyOverlay.scheduleRefresh());
  hooks.on("updateToken", (tokenDocument, changes) => {
    refreshHexOccupancyAfterTokenUpdate(tokenDocument, changes);
  });
  hooks.on("deleteToken", () => hexOccupancyOverlay.scheduleRefresh());
  hooks.on("updateScene", scene => {
    if (scene?.id === globalThis.canvas?.scene?.id) hexOccupancyOverlay.scheduleRefresh();
  });
  hooks.on("updateActor", () => hexOccupancyOverlay.scheduleRefresh());
  hooks.on("createActiveEffect", () => hexOccupancyOverlay.refreshPickerState());
  hooks.on("updateActiveEffect", () => hexOccupancyOverlay.refreshPickerState());
  hooks.on("deleteActiveEffect", () => hexOccupancyOverlay.refreshPickerState());
  hooks.on("sightRefresh", () => hexOccupancyOverlay.scheduleRefresh());
  hooks.on("visibilityRefresh", () => hexOccupancyOverlay.scheduleRefresh());
  hooks.on("controlToken", () => hexOccupancyOverlay.refreshPickerState());
  hooks.on("targetToken", () => hexOccupancyOverlay.refreshPickerState());
  hooks.on("gumHexOccupancySettingChanged", () => hexOccupancyOverlay.scheduleRefresh());
  globalThis.window?.addEventListener?.("resize", () => globalThis.canvas?.gumHexOccupancy?.syncMarkerScale?.());
}
