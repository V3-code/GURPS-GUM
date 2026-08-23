import test from "node:test";
import assert from "node:assert/strict";
import { measureGridDistance } from "../module/utils/grid-distance.mjs";

const point = (i, j) => ({ i, j });

function foundryGrid() {
  return {
    getOffset: ({ x, y }) => point(y, x),
    getDirectPath: ([from, to]) => {
      const steps = Math.max(Math.abs(to.i - from.i), Math.abs(to.j - from.j));
      return Array.from({ length: steps + 1 }, (_, index) => point(from.i + index, from.j + index));
    }
  };
}

test("normaliza vizinhos ortogonais e diagonais para uma unidade da grade", () => {
  const grid = foundryGrid();

  assert.equal(measureGridDistance(grid, { x: 0, y: 0 }, { x: 1, y: 0 }, 1), 1);
  assert.equal(measureGridDistance(grid, { x: 0, y: 0 }, { x: 1, y: 1 }, 1), 1);
});

test("multiplica os passos pelo valor de distância configurado na cena", () => {
  assert.equal(measureGridDistance(foundryGrid(), { x: 0, y: 0 }, { x: 3, y: 3 }, 2), 6);
});

test("usa as APIs de medição do Foundry como fallback", () => {
  const measurePathGrid = { measurePath: () => ({ distance: 4 }) };
  const legacyGrid = { measureDistance: () => 5 };

  assert.equal(measureGridDistance(measurePathGrid, { x: 0, y: 0 }, { x: 1, y: 1 }), 4);
  assert.equal(measureGridDistance(legacyGrid, { x: 0, y: 0 }, { x: 1, y: 1 }), 5);
});