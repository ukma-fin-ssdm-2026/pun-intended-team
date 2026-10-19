// Written with the help of Claude
// AI Usage: SVG path of the Figma tab bar for any width; reviewed by Daryna Halytska.

// The notch geometry is taken from the Figma bar shape (72 px high, 168 px notch): it keeps its size, only the
// straight parts of the bar stretch with the screen width.
export const BAR_HEIGHT = 72;
// Figma draws a 22 px white safe area under the bar; a device with a larger bottom inset uses its own.
const MIN_SAFE_AREA = 22;
export const tabBarSafeArea = (bottomInset: number) => Math.max(bottomInset, MIN_SAFE_AREA);

const NOTCH_HALF_WIDTH = 84;
const NOTCH_DEPTH = 48;
const CORNER_RADIUS = 24;
// Figma shrinks the outer corner to 6 px when the notch reaches the edge (first and last tab).
const MIN_CORNER_RADIUS = 6;
// Control-point offset that approximates a quarter circle with a cubic curve.
const KAPPA = 0.5523;

type Side = { corner: number; shoulderStart: number };

function side(distanceToEdge: number): Side {
  if (distanceToEdge >= CORNER_RADIUS) return { corner: CORNER_RADIUS, shoulderStart: distanceToEdge };
  const corner = Math.max(MIN_CORNER_RADIUS, distanceToEdge);
  return { corner, shoulderStart: corner };
}

const round = (value: number) => Math.round(value * 100) / 100;

// `center` is the x of the active tab's centre; the path is in bar coordinates (0..width × 0..72).
export function tabBarPath(width: number, center: number): string {
  const c = center;
  const left = side(c - NOTCH_HALF_WIDTH);
  const right = side(width - (c + NOTCH_HALF_WIDTH));
  const leftStart = left.shoulderStart;
  const rightStart = width - right.shoulderStart;

  // The shoulder runs 60 px from where the notch leaves the top edge; its first control point sits 40 px in. When the
  // notch reaches the corner, the shoulder is shorter and Figma puts that point at 45% of its length.
  const shoulderHandle = (length: number) => (length > 59.9 ? 40 : 0.45 * length);
  const leftHandle = shoulderHandle(c - 24.04 - leftStart);
  const rightHandle = shoulderHandle(rightStart - (c + 24.04));
  const lk = left.corner * (1 - KAPPA);
  const rk = right.corner * (1 - KAPPA);

  const commands = [
    `M0 ${BAR_HEIGHT}`,
    `V${left.corner}`,
    `C0 ${lk} ${lk} 0 ${left.corner} 0`,
    `H${leftStart}`,
    `C${leftStart + leftHandle} 0 ${c - 44.04} 18.04 ${c - 24.04} 38.04`,
    `C${c - 17.66} 44.42 ${c - 9.02} ${NOTCH_DEPTH} ${c} ${NOTCH_DEPTH}`,
    `C${c + 9.02} ${NOTCH_DEPTH} ${c + 17.66} 44.42 ${c + 24.04} 38.04`,
    `C${c + 44.04} 18.04 ${rightStart - rightHandle} 0 ${rightStart} 0`,
    `H${width - right.corner}`,
    `C${width - rk} 0 ${width} ${rk} ${width} ${right.corner}`,
    `V${BAR_HEIGHT}`,
    'Z',
  ];
  return commands.join(' ').replace(/-?\d+\.\d+/g, (n) => String(round(Number(n))));
}
