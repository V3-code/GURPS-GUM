import assert from "node:assert/strict";
import test from "node:test";

import { clampFloatingPanelPosition } from "../module/utils/floating-panel-position.mjs";

test("floating quick-use menus stay inside the viewport", () => {
  assert.deepEqual(clampFloatingPanelPosition({
    left: 950, top: 740, width: 240, height: 300,
    viewportWidth: 1000, viewportHeight: 800, margin: 8
  }), { left: 752, top: 492 });
  assert.deepEqual(clampFloatingPanelPosition({
    left: -40, top: -10, width: 240, height: 300,
    viewportWidth: 1000, viewportHeight: 800, margin: 8
  }), { left: 8, top: 8 });
});

test("oversized quick-use menus remain anchored to the viewport margin", () => {
  assert.deepEqual(clampFloatingPanelPosition({
    left: 400, top: 300, width: 1200, height: 900,
    viewportWidth: 1000, viewportHeight: 800, margin: 8
  }), { left: 8, top: 8 });
  assert.deepEqual(clampFloatingPanelPosition({
    left: -120, top: -80, width: 1200, height: 900,
    viewportWidth: 1000, viewportHeight: 800, margin: 8
  }), { left: -120, top: -80 });
});
