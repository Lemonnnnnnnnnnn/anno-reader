/**
 * Clamp a position value to stay within container bounds.
 *
 * Ensures the element (at the given position with the given size)
 * stays within the container with the specified padding from edges.
 *
 * @param value - The position value (top or left)
 * @param containerSize - The container dimension (height or width)
 * @param elementSize - The element dimension (height or width)
 * @param padding - Minimum distance from container edges (default: 8px)
 * @returns The clamped position value
 */
export function clampToViewport(
  value: number,
  containerSize: number,
  elementSize: number,
  padding = 8,
): number {
  return Math.max(padding, Math.min(value, containerSize - elementSize - padding));
}
