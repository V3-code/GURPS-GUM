import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const overlay = fs.readFileSync(new URL("../module/canvas/hex-occupancy-overlay.js", import.meta.url), "utf8");
const layer = fs.readFileSync(new URL("../module/canvas/hex-occupancy-layer.mjs", import.meta.url), "utf8");
const main = fs.readFileSync(new URL("../scripts/main.js", import.meta.url), "utf8");
const settings = fs.readFileSync(new URL("../module/settings.js", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../styles/hex-occupancy.css", import.meta.url), "utf8");
const manifest = JSON.parse(fs.readFileSync(new URL("../system.json", import.meta.url), "utf8"));
const pt = JSON.parse(fs.readFileSync(new URL("../lang/pt-BR.json", import.meta.url), "utf8"));
const en = JSON.parse(fs.readFileSync(new URL("../lang/en.json", import.meta.url), "utf8"));

test("registers an opt-in world setting and ships the persistent-window stylesheet", () => {
  assert.match(settings, /"tacticalHexOccupancyEnabled"[\s\S]*?scope:\s*"world"[\s\S]*?default:\s*false/);
  assert.ok(manifest.styles.includes("styles/hex-occupancy.css"));
  assert.match(styles, /\.gum-hex-occupancy-picker/);
});

test("registers a native PIXI layer above tokens and below Foundry controls", () => {
  assert.match(layer, /class GumHexOccupancyLayer extends CanvasLayerBase/);
  assert.match(layer, /name: "gumHexOccupancy"/);
  assert.match(layer, /zIndex: 950/);
  assert.match(layer, /group: "interface"/);
  assert.match(main, /registerHexOccupancyCanvasLayer\(CONFIG\)/);
  assert.doesNotMatch(overlay, /gum-hex-occupancy-overlay|document\.createElement\("button"\)[\s\S]*?groupKey/);
});

test("uses public canvas lifecycle hooks without overriding Token internals", () => {
  for (const hook of ["canvasReady", "canvasTearDown", "canvasPan", "createToken", "updateToken", "deleteToken", "updateScene", "sightRefresh", "visibilityRefresh"]) {
    assert.match(overlay, new RegExp(`hooks\\.on\\(\\"${hook}\\"`));
  }
  assert.doesNotMatch(overlay, /Token\.prototype|TokenLayer\.prototype|_onClickLeft\s*=/);
  assert.match(overlay, /token\?\.control\?\./);
  assert.match(overlay, /token\?\.setTarget\?\./);
});

test("refreshes marker presentation on canvasPan without inverse zoom compensation", () => {
  assert.match(overlay, /canvasPan[\s\S]*position\?\.scale/);
  assert.doesNotMatch(layer, /screenScale\s*\/\s*cameraScale/);
  assert.match(layer, /canvasScale/);
});

test("rebuilds occupancy after Foundry finishes an animated token movement", () => {
  assert.match(overlay, /hooks\.on\("updateToken", \(tokenDocument, changes\)/);
  assert.match(overlay, /tokenDocument\?\.object\?\.movementAnimationPromise/);
  assert.match(overlay, /Promise\.resolve\(movement\)\.then/);
  assert.match(overlay, /OCCUPANCY_POSITION_FIELDS/);
  assert.match(overlay, /return;\s*}\s*\/\/ Non-animated movement/);
});

test("anchors markers to the current stage values during canvas panning", () => {
  assert.match(layer, /marker\.position\.set\(group\.center\.x, group\.center\.y\)/);
  assert.match(layer, /marker\.scale\.set\(canvasScale, canvasScale\)/);
  assert.match(overlay, /syncMarkerScale\?\.\(position\?\.scale\)/);
  assert.match(layer, /marker\.on\("pointertap"/);
});

test("allows the occupant picker to be dragged by its header", () => {
  assert.match(overlay, /makePickerDraggable\(picker, header\)/);
  assert.match(overlay, /header\.addEventListener\("pointerdown"/);
  assert.match(overlay, /document\.addEventListener\("pointermove", onMove\)/);
  assert.match(overlay, /positionPickerAt\(picker/);
  assert.match(styles, /\.gum-hex-occupancy-picker\.is-dragging > header[\s\S]*?cursor:\s*grabbing/);
});

test("keeps the occupant window persistent and supports minimize and restore", () => {
  assert.doesNotMatch(overlay, /document\.addEventListener\("pointerdown", this\._outsidePointerHandler/);
  assert.match(overlay, /setPickerMinimized\(!this\.pickerMinimized\)/);
  assert.match(overlay, /gum-hex-occupancy-minimize/);
  assert.match(overlay, /setPickerOccupancyEnded\(true\)/);
  assert.match(styles, /\.gum-hex-occupancy-picker\.is-minimized/);
  assert.match(styles, /\.gum-hex-occupancy-picker\.is-ended \.gum-hex-occupancy-ended/);
});

test("delegates multi-hex footprints to Foundry's occupied-grid API", () => {
  const occupancy = fs.readFileSync(new URL("../module/utils/hex-occupancy.mjs", import.meta.url), "utf8");
  assert.match(occupancy, /getOccupiedGridSpaceOffsets/);
  assert.match(occupancy, /for \(const \{ i, j, elevation \} of getTokenOccupiedGridOffsets/);
});

test("localizes the setting and picker actions in English and Portuguese", () => {
  const keys = [...settings.matchAll(/"(GUM\.(?:Settings\.HexOccupancy|HexOccupancy)\.[A-Za-z0-9]+)"/g),
    ...overlay.matchAll(/"(GUM\.HexOccupancy\.[A-Za-z0-9]+)"/g)].map(match => match[1]);
  assert.ok(keys.length >= 10);
  for (const key of new Set(keys)) {
    assert.equal(typeof pt[key], "string", `missing pt-BR key ${key}`);
    assert.equal(typeof en[key], "string", `missing en key ${key}`);
  }
});
