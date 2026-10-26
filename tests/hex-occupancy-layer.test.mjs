import assert from "node:assert/strict";
import test from "node:test";

import {
  GumHexOccupancyLayer,
  HEX_OCCUPANCY_MARKER_FRAME,
  HEX_OCCUPANCY_MARKER_STYLE,
  registerHexOccupancyCanvasLayer
} from "../module/canvas/hex-occupancy-layer.mjs";

test("registers the occupancy layer in Foundry's transformed interface group", () => {
  const config = { Canvas: { layers: {} } };
  assert.equal(registerHexOccupancyCanvasLayer(config), true);
  assert.equal(config.Canvas.layers.gumHexOccupancy.layerClass, GumHexOccupancyLayer);
  assert.equal(config.Canvas.layers.gumHexOccupancy.group, "interface");
  assert.equal(GumHexOccupancyLayer.layerOptions.name, "gumHexOccupancy");
  assert.equal(GumHexOccupancyLayer.layerOptions.zIndex, 950);
});

test("keeps the marker at a fixed canvas scale like a token", () => {
  const layer = new GumHexOccupancyLayer();
  const applied = [];
  layer.markers.set("hex", { scale: { set: (x, y) => applied.push([x, y]) } });

  layer.syncMarkerScale(2);
  layer.syncMarkerScale(0.5);
  assert.deepEqual(applied, [[0.8, 0.8], [0.8, 0.8]]);
  assert.equal(2 * applied[0][0], 1.6);
  assert.equal(0.5 * applied[1][0], 0.4);
});

test("preserves the original large, layered marker proportions", () => {
  assert.deepEqual(HEX_OCCUPANCY_MARKER_STYLE, {
    frameSize: 64,
    canvasScale: 0.8,
    outerRadius: 26,
    segmentRadius: 21.5,
    centerRadius: 19.2,
    hitRadius: 30
  });
  assert.equal(HEX_OCCUPANCY_MARKER_FRAME, "systems/gum/assets/ui/hex-occupancy-marker-frame.svg");
});

test("renders an interactive segmented marker at the occupied hex center", () => {
  class Container {
    constructor() {
      this.children = [];
      this.events = {};
      this.position = { set: (x, y) => { this.x = x; this.y = y; } };
      this.scale = { set: (x, y) => { this.scaleX = x; this.scaleY = y; } };
    }
    addChild(child) { this.children.push(child); return child; }
    removeChildren() { return this.children.splice(0); }
    on(name, callback) { this.events[name] = callback; return this; }
    destroy() {}
  }
  class Graphics extends Container {
    beginFill() { return this; }
    moveTo() { return this; }
    arc() { return this; }
    lineTo() { return this; }
    endFill() { return this; }
    lineStyle() { return this; }
    drawCircle() { return this; }
  }
  class Text extends Container {
    constructor(text) {
      super();
      this.text = text;
      this.anchor = { set: () => {} };
    }
  }
  class Sprite extends Container {
    static from(source) {
      const sprite = new Sprite();
      sprite.source = source;
      sprite.anchor = { set: (x, y) => { sprite.anchorX = x; sprite.anchorY = y; } };
      return sprite;
    }
  }
  class Circle { constructor(x, y, radius) { Object.assign(this, { x, y, radius }); } }

  const previousPIXI = globalThis.PIXI;
  const previousCanvas = globalThis.canvas;
  globalThis.PIXI = { Container, Graphics, Sprite, Text, Circle };
  globalThis.canvas = { stage: { scale: { x: 2 } } };
  try {
    const layer = new GumHexOccupancyLayer();
    layer.children = [];
    layer.addChild = child => (layer.children.push(child), child);
    layer.removeChildren = () => layer.children.splice(0);
    let activated = null;
    layer.renderGroups([{
      key: "2:3:0",
      center: { x: 350, y: 250 },
      tokens: [{ id: "a", document: {} }, { id: "b", document: {} }]
    }], { onActivate: key => { activated = key; } });

    const marker = layer.markers.get("2:3:0");
    assert.ok(marker);
    assert.equal(marker.x, 350);
    assert.equal(marker.y, 250);
    assert.equal(marker.scaleX, 0.8);
    assert.equal(marker.hitArea.radius, 30);
    const frame = marker.children.find(child => child.name === "occupancy-frame");
    const count = marker.children.find(child => child.name === "occupancy-count");
    assert.equal(frame.source, HEX_OCCUPANCY_MARKER_FRAME);
    assert.equal(frame.width, 64);
    assert.equal(frame.height, 64);
    assert.equal(count.text, "2");
    marker.events.pointertap({ stopPropagation() {} });
    assert.equal(activated, "2:3:0");
  } finally {
    globalThis.PIXI = previousPIXI;
    globalThis.canvas = previousCanvas;
  }
});
