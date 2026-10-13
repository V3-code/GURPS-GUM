import assert from "node:assert/strict";
import test from "node:test";
import { buildHexOccupancyGroups, getTokenOccupiedGridOffsets, isHexagonalGrid } from "../module/utils/hex-occupancy.mjs";

const token = (id, x, y, elevation = 0, visible = true) => ({
  id,
  center: { x, y },
  visible,
  document: { id, elevation }
});

const grid = {
  isHexagonal: true,
  getOffset: ({ x, y }) => ({ i: Math.floor(y / 100), j: Math.floor(x / 100) }),
  getCenterPoint: ({ i, j }) => ({ x: j * 100 + 50, y: i * 100 + 50 })
};

test("groups two or more tokens in the same hex and elevation", () => {
  const groups = buildHexOccupancyGroups([
    token("b", 130, 140),
    token("a", 110, 120),
    token("c", 250, 120)
  ], { grid });

  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, "1:1:0");
  assert.deepEqual(groups[0].tokens.map(entry => entry.id), ["a", "b"]);
  assert.deepEqual(groups[0].center, { x: 150, y: 150 });
});

test("keeps equal hexes at different elevations in separate buckets", () => {
  const groups = buildHexOccupancyGroups([
    token("ground-a", 110, 120, 0),
    token("ground-b", 130, 140, 0),
    token("air-a", 110, 120, 3),
    token("air-b", 130, 140, 3)
  ], { grid });

  assert.deepEqual(groups.map(group => group.key), ["1:1:0", "1:1:3"]);
});

test("honors viewer filtering and ignores non-hexagonal scenes", () => {
  const tokens = [token("shown-a", 110, 120), token("shown-b", 130, 140), token("hidden", 125, 135, 0, false)];
  const groups = buildHexOccupancyGroups(tokens, { grid, tokenFilter: entry => entry.visible });
  assert.equal(groups[0].tokens.length, 2);
  assert.equal(isHexagonalGrid({ isHexagonal: false }), false);
  assert.deepEqual(buildHexOccupancyGroups(tokens, { grid: { ...grid, isHexagonal: false } }), []);
});

test("uses Foundry occupied grid offsets for multi-hex tokens", () => {
  const large = token("large", 150, 150);
  large.document.getOccupiedGridSpaceOffsets = () => [
    { i: 1, j: 1, k: 0 },
    { i: 1, j: 2, k: 0 },
    { i: 2, j: 1, k: 0 },
    { i: 2, j: 2, k: 0 }
  ];
  const left = token("left", 150, 150);
  left.document.getOccupiedGridSpaceOffsets = () => [{ i: 1, j: 1, k: 0 }];
  const right = token("right", 250, 150);
  right.document.getOccupiedGridSpaceOffsets = () => [{ i: 1, j: 2, k: 0 }];

  const groups = buildHexOccupancyGroups([large, left, right], { grid });
  assert.deepEqual(groups.map(group => group.key), ["1:1:0", "1:2:0"]);
  assert.deepEqual(groups[0].tokens.map(entry => entry.id), ["large", "left"]);
  assert.deepEqual(groups[1].tokens.map(entry => entry.id), ["large", "right"]);
});

test("deduplicates native occupied offsets and keeps vertical grid layers separate", () => {
  const multi = token("multi", 150, 150);
  multi.document.getOccupiedGridSpaceOffsets = () => [
    { i: 1, j: 1, k: 0 }, { i: 1, j: 1, k: 0 }, { i: 1, j: 1, k: 1 }
  ];
  assert.deepEqual(getTokenOccupiedGridOffsets(multi, grid), [
    { i: 1, j: 1, elevation: 0 },
    { i: 1, j: 1, elevation: 1 }
  ]);

  const ground = token("ground", 150, 150);
  ground.document.getOccupiedGridSpaceOffsets = () => [{ i: 1, j: 1, k: 0 }];
  const groups = buildHexOccupancyGroups([multi, ground], { grid });
  assert.deepEqual(groups.map(group => group.key), ["1:1:0"]);
});
