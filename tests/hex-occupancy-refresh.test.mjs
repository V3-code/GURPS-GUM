import assert from "node:assert/strict";
import test from "node:test";

import {
  canvasPointToViewport,
  refreshHexOccupancyAfterTokenUpdate,
  tokenUpdateAffectsHexOccupancy
} from "../module/canvas/hex-occupancy-overlay.js";

test("anchors markers using the current canvas pivot and scale during canvasPan", () => {
  const canvas = {
    stage: {
      position: { x: 600, y: 400 },
      pivot: { x: 300, y: 200 },
      scale: { x: 2, y: 2 }
    },
    // Simulate PIXI's previous-frame worldTransform still being exposed by the
    // public conversion method at the instant the canvasPan hook fires.
    clientCoordinatesFromCanvas: () => ({ x: -1, y: -1 })
  };

  assert.deepEqual(canvasPointToViewport({ x: 325, y: 210 }, canvas), { x: 650, y: 420 });
});

test("falls back to Foundry's coordinate conversion when stage components are unavailable", () => {
  const canvas = { clientCoordinatesFromCanvas: point => ({ x: point.x + 1, y: point.y + 2 }) };
  assert.deepEqual(canvasPointToViewport({ x: 10, y: 20 }, canvas), { x: 11, y: 22 });
});

test("identifies token changes which can alter hex occupancy", () => {
  for (const field of ["x", "y", "elevation", "width", "height", "shape", "hidden"]) {
    assert.equal(tokenUpdateAffectsHexOccupancy({ [field]: 1 }), true, field);
  }
  assert.equal(tokenUpdateAffectsHexOccupancy({ name: "New name" }), false);
});

test("waits for animated token movement before rebuilding occupied hexes", async () => {
  let finishMovement;
  const movementAnimationPromise = new Promise(resolve => { finishMovement = resolve; });
  const overlay = {
    refreshes: 0,
    scheduleRefresh() { this.refreshes += 1; }
  };

  refreshHexOccupancyAfterTokenUpdate({ object: { movementAnimationPromise } }, { x: 100 }, overlay);
  assert.equal(overlay.refreshes, 0);

  finishMovement();
  await movementAnimationPromise;
  await Promise.resolve();
  assert.equal(overlay.refreshes, 1);
});

test("non-positional token updates need only the immediate refresh", async () => {
  const overlay = {
    refreshes: 0,
    scheduleRefresh() { this.refreshes += 1; }
  };
  const tokenDocument = { object: { movementAnimationPromise: Promise.resolve() } };

  refreshHexOccupancyAfterTokenUpdate(tokenDocument, { name: "Updated" }, overlay);
  await Promise.resolve();
  assert.equal(overlay.refreshes, 1);
});
