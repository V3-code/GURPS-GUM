import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGridOccupancyGroups,
  getTokenOccupiedGridOffsets,
  isHexagonalGrid,
  isSquareGrid,
  isSupportedOccupancyGrid
} from "../module/utils/hex-occupancy.mjs";

const token = (id, x, y, elevation = 0, visible = true) => ({
  id,
  center: { x, y },
  visible,
  document: { id, elevation }
});

const hexGrid = {
  isHexagonal: true,
  getOffset: ({ x, y }) => ({ i: Math.floor(y / 100), j: Math.floor(x / 100) }),
  getCenterPoint: ({ i, j }) => ({ x: j * 100 + 50, y: i * 100 + 50 })
};

test("groups two or more tokens in the same hex", () => {
  const groups = buildGridOccupancyGroups([
    token("b", 130, 140),
    token("a", 110, 120),
    token("c", 250, 120)
  ], { grid: hexGrid });

  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, "1:1");
  assert.deepEqual(groups[0].tokens.map(entry => entry.id), ["a", "b"]);
  assert.deepEqual(groups[0].center, { x: 150, y: 150 });
});

test("keeps different elevations in one stable grid-space group", () => {
  const groups = buildGridOccupancyGroups([
    token("ground-a", 110, 120, 0),
    token("ground-b", 130, 140, 0),
    token("air-a", 110, 120, 3),
    token("air-b", 130, 140, 3)
  ], { grid: hexGrid });

  assert.deepEqual(groups.map(group => group.key), ["1:1"]);
  assert.deepEqual(groups[0].tokens.map(entry => entry.id), ["air-a", "air-b", "ground-a", "ground-b"]);

  groups[0].tokens[0].document.elevation = 12;
  const refreshed = buildGridOccupancyGroups(groups[0].tokens, { grid: hexGrid });
  assert.equal(refreshed[0].key, groups[0].key);
});

test("honors viewer filtering and ignores gridless scenes", () => {
  const tokens = [token("shown-a", 110, 120), token("shown-b", 130, 140), token("hidden", 125, 135, 0, false)];
  const groups = buildGridOccupancyGroups(tokens, { grid: hexGrid, tokenFilter: entry => entry.visible });
  assert.equal(groups[0].tokens.length, 2);
  assert.equal(isHexagonalGrid({ isHexagonal: false }), false);
  const gridless = { ...hexGrid, isHexagonal: false, isGridless: true, type: 0 };
  assert.equal(isSupportedOccupancyGrid(gridless), false);
  assert.deepEqual(buildGridOccupancyGroups(tokens, { grid: gridless }), []);
});

test("groups tokens that share a square grid space", () => {
  const squareGrid = {
    isHexagonal: false,
    isGridless: false,
    type: 1,
    getOffset: hexGrid.getOffset,
    getCenterPoint: hexGrid.getCenterPoint
  };
  const groups = buildGridOccupancyGroups([
    token("square-b", 190, 110),
    token("square-a", 105, 195),
    token("other", 205, 195)
  ], { grid: squareGrid });

  assert.equal(isSquareGrid(squareGrid), true);
  assert.equal(isSupportedOccupancyGrid(squareGrid), true);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, "1:1");
  assert.deepEqual(groups[0].tokens.map(entry => entry.id), ["square-a", "square-b"]);
  assert.deepEqual(groups[0].center, { x: 150, y: 150 });
});

test("uses every occupied square for large tokens", () => {
  const squareGrid = {
    isHexagonal: false,
    isGridless: false,
    type: 1,
    getOffset: hexGrid.getOffset,
    getCenterPoint: hexGrid.getCenterPoint
  };
  const large = token("large", 150, 150);
  large.document.getOccupiedGridSpaceOffsets = () => [
    { i: 1, j: 1, k: 0 },
    { i: 1, j: 2, k: 0 }
  ];
  const left = token("left", 150, 150);
  left.document.getOccupiedGridSpaceOffsets = () => [{ i: 1, j: 1, k: 0 }];
  const right = token("right", 250, 150);
  right.document.getOccupiedGridSpaceOffsets = () => [{ i: 1, j: 2, k: 0 }];

  const groups = buildGridOccupancyGroups([large, left, right], { grid: squareGrid });
  assert.deepEqual(groups.map(group => group.key), ["1:1", "1:2"]);
  assert.deepEqual(groups[0].tokens.map(entry => entry.id), ["large", "left"]);
  assert.deepEqual(groups[1].tokens.map(entry => entry.id), ["large", "right"]);
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

  const groups = buildGridOccupancyGroups([large, left, right], { grid: hexGrid });
  assert.deepEqual(groups.map(group => group.key), ["1:1", "1:2"]);
  assert.deepEqual(groups[0].tokens.map(entry => entry.id), ["large", "left"]);
  assert.deepEqual(groups[1].tokens.map(entry => entry.id), ["large", "right"]);
});

test("deduplicates native occupied offsets without treating k as elevation", () => {
  const multi = token("multi", 150, 150);
  multi.document.getOccupiedGridSpaceOffsets = () => [
    { i: 1, j: 1, k: 0 }, { i: 1, j: 1, k: 0 }, { i: 1, j: 1, k: 1 }
  ];
  assert.deepEqual(getTokenOccupiedGridOffsets(multi, hexGrid), [{ i: 1, j: 1 }]);

  const ground = token("ground", 150, 150);
  ground.document.getOccupiedGridSpaceOffsets = () => [{ i: 1, j: 1, k: 0 }];
  const groups = buildGridOccupancyGroups([multi, ground], { grid: hexGrid });
  assert.deepEqual(groups.map(group => group.key), ["1:1"]);
});
