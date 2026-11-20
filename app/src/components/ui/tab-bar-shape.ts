// Written with the help of Claude
// AI Usage: SVG path of the Figma tab bar for any width; reviewed by Daryna Halytska.

// The notch geometry is taken from the Figma bar shape (72 px high, 168 px notch): it keeps its size, only the
// straight parts of the bar stretch with the screen width.
export const BAR_HEIGHT = 72;
// "Нижня навігація" is 84 px in Figma: the 72 px bar and a 12 px white safe area, flush with the bottom of the screen.
// A device with a larger bottom inset uses its own instead of the 12 px.
const MIN_SAFE_AREA = 12;
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

// `center` is the x of the active tab's centre; the path is in bar coordinates (0..width × 0..height). Below the
// notch the sides run straight down, so a taller bar reaches the bottom edge in one shape, without a seam.
export function tabBarPath(width: number, center: number, height = BAR_HEIGHT): string {
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
    `M0 ${height}`,
    `V${left.corner}`,
    `C0 ${lk} ${lk} 0 ${left.corner} 0`,
    `H${leftStart}`,
    `C${leftStart + leftHandle} 0 ${c - 44.04} 18.04 ${c - 24.04} 38.04`,
    `C${c - 17.66} 44.42 ${c - 9.02} ${NOTCH_DEPTH} ${c} ${NOTCH_DEPTH}`,
    `C${c + 9.02} ${NOTCH_DEPTH} ${c + 17.66} 44.42 ${c + 24.04} 38.04`,
    `C${c + 44.04} 18.04 ${rightStart - rightHandle} 0 ${rightStart} 0`,
    `H${width - right.corner}`,
    `C${width - rk} 0 ${width} ${rk} ${width} ${right.corner}`,
    `V${height}`,
    'Z',
  ];
  return commands.join(' ').replace(/-?\d+\.\d+/g, (n) => String(round(Number(n))));
}

// "Форма з вирізом" of "таб бар новий" (the event page's action bar): a wide notch, 62 px deep with a 170 px flat
// bottom, that holds the "Знайти метч" button. Its points are offsets from the bar's centre, taken from Figma at
// 390 px; the straight parts stretch with the screen width.
const ACTION_NOTCH_DEPTH = 62;
const ACTION_NOTCH_FLAT = 85.22;
const ACTION_NOTCH_HALF_WIDTH = 163.35;
// The shoulder from the top edge into the notch, as [x offset, y] pairs: two cubic curves.
const ACTION_SHOULDER: [number, number][] = [
  [130.2, 0],
  [133.32, 25.11],
  [112.01, 49.37],
  [104.9, 57.46],
  [95.27, ACTION_NOTCH_DEPTH],
  [ACTION_NOTCH_FLAT, ACTION_NOTCH_DEPTH],
];

// The width of "Кнопка / Знайти мені метч" the Figma notch is drawn around.
export const ACTION_NOTCH_BUTTON_WIDTH = 232;

// The path of the action bar, in bar coordinates (0..width × 0..height), around a button `buttonWidth` wide. A wider
// button, such as "Стежити за метчингом", widens the flat bottom by as much on each side, so it keeps the Figma margins
// to the shoulders. When the notch would run into the rounded corners, the shoulders get steeper instead.
export function actionBarPath(width: number, height: number, buttonWidth = ACTION_NOTCH_BUTTON_WIDTH): string {
  const c = width / 2;
  const extra = Math.max(0, (buttonWidth - ACTION_NOTCH_BUTTON_WIDTH) / 2);
  const flat = ACTION_NOTCH_FLAT + extra;
  const room = c - CORNER_RADIUS - flat;
  const squeeze = Math.max(0, Math.min(1, room / (ACTION_NOTCH_HALF_WIDTH - ACTION_NOTCH_FLAT)));
  const dx = (offset: number) => flat + (offset - ACTION_NOTCH_FLAT) * squeeze;
  const point = (side: -1 | 1, [offset, y]: [number, number]) => `${c + side * dx(offset)} ${y}`;
  const coords = (side: -1 | 1, points: [number, number][]) => points.map((p) => point(side, p)).join(' ');
  // Two cubic curves: three points each.
  const curves = (side: -1 | 1, points: [number, number][]) => [
    `C${coords(side, points.slice(0, 3))}`,
    `C${coords(side, points.slice(3))}`,
  ];
  const k = CORNER_RADIUS * (1 - KAPPA);
  // The right shoulder runs the same points in reverse: from the flat bottom up to the top edge.
  const rightShoulder: [number, number][] = [...ACTION_SHOULDER.slice(0, -1).reverse(), [ACTION_NOTCH_HALF_WIDTH, 0]];

  const commands = [
    `M0 ${height}`,
    `V${CORNER_RADIUS}`,
    `C0 ${k} ${k} 0 ${CORNER_RADIUS} 0`,
    `H${c - dx(ACTION_NOTCH_HALF_WIDTH)}`,
    ...curves(-1, ACTION_SHOULDER),
    `H${c + flat}`,
    ...curves(1, rightShoulder),
    `H${width - CORNER_RADIUS}`,
    `C${width - k} 0 ${width} ${k} ${width} ${CORNER_RADIUS}`,
    `V${height}`,
    'Z',
  ];
  return commands.join(' ').replace(/-?\d+\.\d+/g, (n) => String(round(Number(n))));
}
