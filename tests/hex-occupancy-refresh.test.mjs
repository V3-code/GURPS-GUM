import assert from "node:assert/strict";
import test from "node:test";

import {
  HexOccupancyOverlay,
  canvasPointToViewport,
  findOccupancyGroupContinuation,
  occupancyMarkerSignature,
  occupancyPanelSignature,
  refreshHexOccupancyAfterTokenUpdate,
  tokenElevationLabel,
  tokenUpdateAffectsHexOccupancy
} from "../module/canvas/hex-occupancy-overlay.js";

test("formats each token elevation using the scene distance units", () => {
  const canvas = { scene: { grid: { units: "ft" } } };
  assert.equal(tokenElevationLabel({ document: { elevation: 2 } }, canvas), "Elevation: +2 ft");
  assert.equal(tokenElevationLabel({ document: { elevation: -1 } }, canvas), "Elevation: -1 ft");
});

test("keeps render signatures stable until marker or panel content changes", () => {
  const left = { id: "left", controlled: false, document: { id: "left", elevation: 0, disposition: 1 } };
  const right = { id: "right", controlled: false, document: { id: "right", elevation: 0, disposition: -1 } };
  const group = { key: "1:1", center: { x: 150, y: 150 }, tokens: [left, right] };

  const markerBefore = occupancyMarkerSignature([group]);
  const panelBefore = occupancyPanelSignature(group);
  assert.equal(occupancyMarkerSignature([group]), markerBefore);
  assert.equal(occupancyPanelSignature(group), panelBefore);

  right.document.elevation = 2;
  assert.equal(occupancyMarkerSignature([group]), markerBefore);
  assert.notEqual(occupancyPanelSignature(group), panelBefore);

  right.document.disposition = 0;
  assert.notEqual(occupancyMarkerSignature([group]), markerBefore);
});

test("does not redraw unchanged occupancy markers on repeated refresh events", () => {
  const originalCanvas = globalThis.canvas;
  const tokens = ["a", "b"].map(id => ({
    id,
    document: {
      id,
      getOccupiedGridSpaceOffsets: () => [{ i: 1, j: 1, k: 0 }]
    }
  }));
  globalThis.canvas = {
    ready: true,
    grid: {
      isHexagonal: false,
      isGridless: false,
      type: 1,
      getOffset: () => ({ i: 1, j: 1 }),
      getCenterPoint: () => ({ x: 150, y: 150 })
    },
    tokens: { placeables: tokens }
  };

  try {
    const overlay = new HexOccupancyOverlay();
    overlay.isEnabled = () => true;
    let renders = 0;
    overlay.renderMarkers = () => { renders += 1; };
    overlay.refresh();
    overlay.refresh();
    overlay.refresh();
    assert.equal(renders, 1);

    tokens[1].document.disposition = -1;
    overlay.refresh();
    assert.equal(renders, 2);
  } finally {
    globalThis.canvas = originalCanvas;
  }
});

test("keeps an open occupant panel active when token elevation changes", () => {
  const originalCanvas = globalThis.canvas;
  const makeToken = (id, elevation) => ({
    id,
    center: { x: 150, y: 150 },
    document: {
      id,
      elevation,
      getOccupiedGridSpaceOffsets: () => [{ i: 1, j: 1, k: 0 }]
    }
  });
  const tokens = [makeToken("ground", 0), makeToken("raised", 2)];
  globalThis.canvas = {
    ready: true,
    grid: {
      isHexagonal: false,
      isGridless: false,
      type: 1,
      getOffset: ({ x, y }) => ({ i: Math.floor(y / 100), j: Math.floor(x / 100) }),
      getCenterPoint: ({ i, j }) => ({ x: j * 100 + 50, y: i * 100 + 50 })
    },
    tokens: { placeables: tokens }
  };

  try {
    const overlay = new HexOccupancyOverlay();
    overlay.isEnabled = () => true;
    overlay.openGroupKey = "1:1";
    let updatedGroup = null;
    let ended = null;
    overlay.updatePickerGroup = group => { updatedGroup = group; };
    overlay.setPickerOccupancyEnded = value => { ended = value; };

    overlay.refresh();
    assert.equal(updatedGroup?.key, "1:1");
    assert.equal(ended, null);

    tokens[1].document.elevation = 7;
    updatedGroup = null;
    overlay.refresh();
    assert.equal(updatedGroup?.key, "1:1");
    assert.equal(ended, null);
  } finally {
    globalThis.canvas = originalCanvas;
  }
});

test("follows the same occupants when their overlap moves to another grid space", () => {
  const originalCanvas = globalThis.canvas;
  let smallOffset = { i: 1, j: 1, k: 0 };
  const large = {
    id: "large",
    document: {
      id: "large",
      elevation: 0,
      getOccupiedGridSpaceOffsets: () => [
        { i: 1, j: 1, k: 0 },
        { i: 1, j: 2, k: 0 }
      ]
    }
  };
  const small = {
    id: "small",
    document: {
      id: "small",
      elevation: 0,
      getOccupiedGridSpaceOffsets: () => [smallOffset]
    }
  };
  globalThis.canvas = {
    ready: true,
    grid: {
      isHexagonal: false,
      isGridless: false,
      type: 1,
      getOffset: () => ({ i: 1, j: 1 }),
      getCenterPoint: ({ i, j }) => ({ x: j * 100 + 50, y: i * 100 + 50 })
    },
    tokens: { placeables: [large, small] }
  };

  try {
    const overlay = new HexOccupancyOverlay();
    overlay.isEnabled = () => true;
    overlay.refresh();
    overlay.openGroupKey = "1:1";
    let updatedGroup = null;
    let ended = false;
    overlay.updatePickerGroup = group => { updatedGroup = group; };
    overlay.setPickerOccupancyEnded = value => { ended = value; };

    smallOffset = { i: 1, j: 2, k: 0 };
    overlay.refresh();

    assert.equal(overlay.openGroupKey, "1:2");
    assert.equal(updatedGroup?.key, "1:2");
    assert.equal(ended, false);
  } finally {
    globalThis.canvas = originalCanvas;
  }
});

test("does not continue an open group when its former occupants no longer overlap", () => {
  const previous = {
    key: "1:1",
    center: { x: 150, y: 150 },
    tokens: [{ id: "large" }, { id: "small" }]
  };
  const unrelated = [{
    key: "1:2",
    center: { x: 250, y: 150 },
    tokens: [{ id: "large" }, { id: "other" }]
  }];
  assert.equal(findOccupancyGroupContinuation(previous, unrelated), null);
});

test("recovers the tracked occupants after a transient animation gap", () => {
  const originalCanvas = globalThis.canvas;
  let smallOffset = { i: 1, j: 1, k: 0 };
  const large = {
    id: "large",
    document: {
      id: "large",
      getOccupiedGridSpaceOffsets: () => [
        { i: 1, j: 1, k: 0 },
        { i: 1, j: 2, k: 0 }
      ]
    }
  };
  const small = {
    id: "small",
    document: {
      id: "small",
      getOccupiedGridSpaceOffsets: () => [smallOffset]
    }
  };
  globalThis.canvas = {
    ready: true,
    grid: {
      isHexagonal: false,
      isGridless: false,
      type: 1,
      getOffset: () => ({ i: 1, j: 1 }),
      getCenterPoint: ({ i, j }) => ({ x: j * 100 + 50, y: i * 100 + 50 })
    },
    tokens: { placeables: [large, small] }
  };

  try {
    const overlay = new HexOccupancyOverlay();
    overlay.isEnabled = () => true;
    overlay.refresh();
    overlay.openGroupKey = "1:1";
    overlay.openGroupSnapshot = overlay.groups.get("1:1");
    let updatedGroup = null;
    let ended = false;
    overlay.updatePickerGroup = group => {
      updatedGroup = group;
      overlay.openGroupSnapshot = group;
    };
    overlay.setPickerOccupancyEnded = value => { ended = value; };

    smallOffset = { i: 3, j: 3, k: 0 };
    overlay.refresh();
    assert.equal(ended, true);

    smallOffset = { i: 1, j: 2, k: 0 };
    ended = false;
    overlay.refresh();
    assert.equal(overlay.openGroupKey, "1:2");
    assert.equal(updatedGroup?.key, "1:2");
    assert.equal(ended, false);
  } finally {
    globalThis.canvas = originalCanvas;
  }
});

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

test("identifies token changes which can alter grid occupancy", () => {
  for (const field of ["x", "y", "elevation", "width", "height", "shape", "hidden"]) {
    assert.equal(tokenUpdateAffectsHexOccupancy({ [field]: 1 }), true, field);
  }
  assert.equal(tokenUpdateAffectsHexOccupancy({ name: "New name" }), false);
});

test("waits for animated token movement before rebuilding occupied grid spaces", async () => {
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
