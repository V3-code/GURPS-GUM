export function clampFloatingPanelPosition({
  left = 0,
  top = 0,
  width = 0,
  height = 0,
  viewportWidth = 0,
  viewportHeight = 0,
  margin = 8
} = {}) {
  const safeMargin = Math.max(0, Number(margin) || 0);
  const horizontalLimit = (Number(viewportWidth) || 0) - (Number(width) || 0) - safeMargin;
  const verticalLimit = (Number(viewportHeight) || 0) - (Number(height) || 0) - safeMargin;
  const clampAxis = (value, limit) => limit >= safeMargin
    ? Math.min(limit, Math.max(safeMargin, Number(value) || 0))
    : Math.min(safeMargin, Math.max(limit, Number(value) || 0));
  return {
    left: clampAxis(left, horizontalLimit),
    top: clampAxis(top, verticalLimit)
  };
}
