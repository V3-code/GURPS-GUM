const finiteCoordinate = value => Number.isFinite(Number(value)) ? Number(value) : null;

export function isHexagonalGrid(grid) {
  return grid?.isHexagonal === true;
}

export function normalizeTokenElevation(token) {
  return finiteCoordinate(token?.document?.elevation ?? token?.elevation) ?? 0;
}

export function getTokenCanvasCenter(token) {
  const center = token?.center ?? token?.getCenterPoint?.();
  if (Number.isFinite(center?.x) && Number.isFinite(center?.y)) {
    return { x: Number(center.x), y: Number(center.y) };
  }

  const document = token?.document ?? token;
  const x = finiteCoordinate(document?.x);
  const y = finiteCoordinate(document?.y);
  const width = finiteCoordinate(token?.w ?? document?.width);
  const height = finiteCoordinate(token?.h ?? document?.height);
  if (x === null || y === null) return null;
  return {
    x: x + Math.max(0, width ?? 0) / 2,
    y: y + Math.max(0, height ?? 0) / 2
  };
}

export function normalizeGridOffset(offset) {
  if (Array.isArray(offset)) {
    const [i, j] = offset;
    return Number.isFinite(Number(i)) && Number.isFinite(Number(j))
      ? { i: Number(i), j: Number(j) }
      : null;
  }

  const i = finiteCoordinate(offset?.i ?? offset?.row);
  const j = finiteCoordinate(offset?.j ?? offset?.column ?? offset?.col);
  return i === null || j === null ? null : { i, j };
}

export function getTokenOccupiedGridOffsets(token, grid) {
  const document = token?.document ?? token;
  if (typeof document?.getOccupiedGridSpaceOffsets === "function") {
    try {
      const occupied = [];
      const seen = new Set();
      for (const rawOffset of document.getOccupiedGridSpaceOffsets() ?? []) {
        const offset = normalizeGridOffset(rawOffset);
        if (!offset) continue;
        const elevation = finiteCoordinate(rawOffset?.k) ?? normalizeTokenElevation(token);
        const key = `${offset.i}:${offset.j}:${elevation}`;
        if (seen.has(key)) continue;
        seen.add(key);
        occupied.push({ ...offset, elevation });
      }
      if (occupied.length) return occupied;
    } catch (_error) {
      // Older documents and lightweight test doubles may not have a complete
      // Scene context. Fall back to the center hex in that case.
    }
  }

  const center = getTokenCanvasCenter(token);
  if (!center || typeof grid?.getOffset !== "function") return [];
  const offset = normalizeGridOffset(grid.getOffset(center));
  return offset ? [{ ...offset, elevation: normalizeTokenElevation(token) }] : [];
}

export function buildHexOccupancyGroups(tokens = [], {
  grid,
  tokenFilter = () => true,
  minimumOccupants = 2
} = {}) {
  if (!isHexagonalGrid(grid) || typeof grid.getOffset !== "function") return [];

  const buckets = new Map();
  for (const token of Array.from(tokens ?? [])) {
    if (!token || !tokenFilter(token)) continue;
    for (const { i, j, elevation } of getTokenOccupiedGridOffsets(token, grid)) {
      const key = `${i}:${j}:${elevation}`;
      const offset = { i, j };
      const bucket = buckets.get(key) ?? { key, offset, elevation, tokens: [] };
      if (!bucket.tokens.includes(token)) bucket.tokens.push(token);
      buckets.set(key, bucket);
    }
  }

  const minimum = Math.max(2, Number(minimumOccupants) || 2);
  return Array.from(buckets.values())
    .filter(group => group.tokens.length >= minimum)
    .map(group => {
      const center = typeof grid.getCenterPoint === "function"
        ? grid.getCenterPoint(group.offset)
        : getTokenCanvasCenter(group.tokens[0]);
      return {
        ...group,
        center: { x: Number(center?.x) || 0, y: Number(center?.y) || 0 },
        tokens: [...group.tokens].sort((left, right) => {
          const leftId = String(left?.id ?? left?.document?.id ?? "");
          const rightId = String(right?.id ?? right?.document?.id ?? "");
          return leftId.localeCompare(rightId);
        })
      };
    })
    .sort((left, right) => left.key.localeCompare(right.key));
}
