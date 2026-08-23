/**
 * Measure the number of grid steps between two points using Foundry's grid path.
 *
 * A direct path represents every occupied grid space, so orthogonal, diagonal,
 * and hexagonal neighbours all cost exactly one scene grid unit.
 */
export function measureGridDistance(grid, origin, destination, gridDistance = 1) {
  if (!grid || !origin || !destination) return null;

  if (typeof grid.getOffset === "function" && typeof grid.getDirectPath === "function") {
    const originOffset = grid.getOffset(origin);
    const destinationOffset = grid.getOffset(destination);
    const path = grid.getDirectPath([originOffset, destinationOffset]);

    if (Array.isArray(path) && path.length > 0) {
      const unitDistance = Number(gridDistance);
      const normalizedUnit = Number.isFinite(unitDistance) && unitDistance > 0 ? unitDistance : 1;
      return Math.max(0, path.length - 1) * normalizedUnit;
    }
  }

  if (typeof grid.measurePath === "function") {
    const path = grid.measurePath([origin, destination]);
    const measured = path?.distance ?? path?.cost;
    if (Number.isFinite(measured)) return measured;
  }

  if (typeof grid.measureDistance === "function") {
    const measured = grid.measureDistance(origin, destination, { gridSpaces: true });
    if (Number.isFinite(measured)) return measured;
  }

  return null;
}