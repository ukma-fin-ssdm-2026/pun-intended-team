// Written with the help of Claude
// AI Usage: mock venue and map shapes from the Figma "Т1 Мапа" frame; reviewed by Daryna Halytska.

// The venue selected on the map, with its events.
export const mockVenue = {
  name: 'Мистецький Арсенал',
  address: 'вул. Лаврська, 10–12 · 650 м',
  eventsLabel: '3 події',
  events: [
    { key: 'jazz', title: 'Джаз-вечір', eventId: '7a2d4b5c-0002-4b00-8000-000000000001' },
    { key: 'open-mic', title: 'Поетичний open mic', eventId: '7a2d4b5c-0002-4b00-8000-000000000005' },
  ],
};

// "00 Мапа" in frame coordinates (390 × 844): each shape by its bounding box in Figma, its own size and rotation.
type Shape = {
  left: number;
  top: number;
  boxWidth: number;
  boxHeight: number;
  width: number;
  height: number;
  rotate: number;
  color: string;
  radius?: number;
};

export const mapShapes: Shape[] = [
  // Парк
  {
    left: 210,
    top: 400,
    boxWidth: 150,
    boxHeight: 130,
    width: 150,
    height: 130,
    rotate: 0,
    color: '#DBE5D6',
    radius: 30,
  },
  // Дніпро
  {
    left: 193.61,
    top: -60,
    boxWidth: 255.222,
    boxHeight: 987.164,
    width: 120,
    height: 980,
    rotate: 8,
    color: '#D1DEE5',
  },
  // Проспект
  { left: -20, top: 250, boxWidth: 440, boxHeight: 14, width: 440, height: 14, rotate: 0, color: '#FFFFFF' },
  // Вулиці
  {
    left: -20,
    top: 474.01,
    boxWidth: 438.635,
    boxHeight: 55.938,
    width: 440,
    height: 10,
    rotate: -6,
    color: '#FFFFFF',
  },
  { left: 120, top: -20, boxWidth: 12, boxHeight: 900, width: 12, height: 900, rotate: 0, color: '#FFFFFF' },
  { left: 177.22, top: -20, boxWidth: 72.756, boxHeight: 898.505, width: 10, height: 900, rotate: 4, color: '#FFFFFF' },
  { left: -21.39, top: 380, boxWidth: 434.705, boxHeight: 84.284, width: 440, height: 8, rotate: 10, color: '#FFFFFF' },
  { left: 40, top: -21.11, boxWidth: 133.178, boxHeight: 892.355, width: 8, height: 900, rotate: -8, color: '#FFFFFF' },
];

// Venue pins with their event counts; the coral one is the selected venue.
export const mapPins = [
  { left: 70, top: 190, size: 36, count: 2, selected: false },
  { left: 180, top: 300, size: 44, count: 3, selected: true },
  { left: 60, top: 440, size: 36, count: 1, selected: false },
  { left: 270, top: 190, size: 36, count: 4, selected: false },
  { left: 250, top: 330, size: 36, count: 2, selected: false },
];

// "Ви тут": an 18 px dot at (150, 410).
export const mapYouAreHere = { left: 150, top: 410 };

// Д2.1 Місце на мапі: the place under the drop pin.
export const mockPostPlace = {
  name: 'Антикафе «Ліхтар»',
  address: 'вул. Ярославська, 22 · Поділ',
};
