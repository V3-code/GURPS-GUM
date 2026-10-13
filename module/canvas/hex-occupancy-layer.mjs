const CanvasLayerBase = globalThis.foundry?.canvas?.layers?.CanvasLayer ?? class {
  static get layerOptions() { return {}; }
};

const DISPOSITION_COLORS = Object.freeze({
  friendly: 0x3fa769,
  hostile: 0xb93e3b,
  secret: 0x805daf,
  neutral: 0xc08b32
});

const FALLBACK_COLORS = Object.freeze([
  0x4d86c6, 0xc66c4d, 0x7e62bd, 0x4b9b91, 0xb7833f, 0x9d527d
]);

export const HEX_OCCUPANCY_MARKER_FRAME = "systems/gum/assets/ui/hex-occupancy-marker-frame.svg";

export const HEX_OCCUPANCY_MARKER_STYLE = Object.freeze({
  frameSize: 64,
  screenScale: 0.8,
  outerRadius: 26,
  segmentRadius: 21.5,
  centerRadius: 19.2,
  hitRadius: 30
});

const tokenId = token => String(token?.id ?? token?.document?.id ?? "");

function tokenColor(token) {
  const disposition = Number(token?.document?.disposition);
  const dispositions = globalThis.CONST?.TOKEN_DISPOSITIONS;
  if (disposition === dispositions?.FRIENDLY) return DISPOSITION_COLORS.friendly;
  if (disposition === dispositions?.HOSTILE) return DISPOSITION_COLORS.hostile;
  if (disposition === dispositions?.SECRET) return DISPOSITION_COLORS.secret;
  if (disposition === dispositions?.NEUTRAL) return DISPOSITION_COLORS.neutral;

  let hash = 0;
  for (const character of tokenId(token)) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

function destroyChildren(container) {
  for (const child of container?.removeChildren?.() ?? []) child.destroy?.({ children: true });
}

export class GumHexOccupancyLayer extends CanvasLayerBase {
  static get layerOptions() {
    return {
      ...super.layerOptions,
      name: "gumHexOccupancy",
      zIndex: 950
    };
  }

  constructor(...args) {
    super(...args);
    this.markers = new Map();
    this.interactiveChildren = true;
    this.eventMode = "passive";
  }

  async _draw(options) {
    await super._draw?.(options);
    this.syncMarkerScale();
  }

  async _tearDown(options) {
    this.markers.clear();
    if (super._tearDown) return super._tearDown(options);
    destroyChildren(this);
  }

  renderGroups(groups = [], { onActivate } = {}) {
    destroyChildren(this);
    this.markers.clear();
    const PIXI = globalThis.PIXI;
    if (!PIXI?.Container || !PIXI?.Graphics || !PIXI?.Sprite || !PIXI?.Text) return;

    for (const group of groups) {
      const marker = this.#createMarker(group, onActivate, PIXI);
      marker.position.set(group.center.x, group.center.y);
      this.addChild(marker);
      this.markers.set(group.key, marker);
    }
    this.syncMarkerScale();
  }

  syncMarkerScale(scale = globalThis.canvas?.stage?.scale?.x) {
    const normalizedScale = Number(scale);
    const cameraScale = Number.isFinite(normalizedScale) && normalizedScale > 0 ? normalizedScale : 1;
    const displayScale = HEX_OCCUPANCY_MARKER_STYLE.screenScale / cameraScale;
    for (const marker of this.markers.values()) marker.scale.set(displayScale, displayScale);
  }

  clearMarkers() {
    destroyChildren(this);
    this.markers.clear();
  }

  #createMarker(group, onActivate, PIXI) {
    const marker = new PIXI.Container();
    marker.name = `gum-hex-occupancy-${group.key}`;
    marker.eventMode = "static";
    marker.cursor = "pointer";
    marker.hitArea = new PIXI.Circle(0, 0, HEX_OCCUPANCY_MARKER_STYLE.hitRadius);
    marker.alpha = 0.98;

    const graphic = marker.addChild(new PIXI.Graphics());
    graphic.name = "occupant-segments";
    const { frameSize, segmentRadius } = HEX_OCCUPANCY_MARKER_STYLE;

    // PIXI owns the live disposition colors; the SVG above it supplies the
    // exact bevel, shadow, rim and count medallion at double source resolution.
    graphic.beginFill(0x111318, 1);
    graphic.drawCircle(0, 0, segmentRadius + 0.8);
    graphic.endFill();

    const step = (Math.PI * 2) / Math.max(1, group.tokens.length);
    group.tokens.forEach((token, index) => {
      const start = (-Math.PI / 2) + (index * step);
      const end = start + step;
      graphic.beginFill(tokenColor(token), 1);
      graphic.moveTo(0, 0);
      graphic.arc(0, 0, segmentRadius, start, end);
      graphic.lineTo(0, 0);
      graphic.endFill();
    });
    const frame = marker.addChild(PIXI.Sprite.from(HEX_OCCUPANCY_MARKER_FRAME));
    frame.name = "occupancy-frame";
    frame.anchor.set(0.5, 0.5);
    frame.width = frameSize;
    frame.height = frameSize;

    const count = marker.addChild(new PIXI.Text(String(group.tokens.length), {
      fontFamily: "Roboto, sans-serif",
      fontSize: 15,
      fontWeight: "800",
      fill: 0xfff5d6,
      align: "center",
      stroke: 0x000000,
      strokeThickness: 2
    }));
    count.name = "occupancy-count";
    count.anchor.set(0.5, 0.5);
    count.resolution = Math.max(1, globalThis.window?.devicePixelRatio ?? 1);

    marker.on("pointerover", () => { marker.alpha = 1; });
    marker.on("pointerout", () => { marker.alpha = 0.98; });
    marker.on("pointertap", event => {
      event.stopPropagation?.();
      onActivate?.(group.key);
    });
    return marker;
  }
}

let layerRegistered = false;

export function registerHexOccupancyCanvasLayer(config = globalThis.CONFIG) {
  if (layerRegistered || !config?.Canvas?.layers) return false;
  config.Canvas.layers.gumHexOccupancy = {
    layerClass: GumHexOccupancyLayer,
    group: "interface"
  };
  layerRegistered = true;
  return true;
}
