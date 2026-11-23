// Written with the help of Claude
import type { CropArea, ImageKind, PixelArea } from '../types/image.ts';

interface ImageKindSettings {
  /** Width to height of the crop the user picks. */
  aspectRatio: number;
  /** True keeps the whole picture and the crop beside it, so a screen of another shape can show more of it. */
  keepWhole: boolean;
  /** The stored picture is scaled down to fit inside this box. */
  maxWidth: number;
  maxHeight: number;
  /** Shown in the catalog, which guests browse; pictures of people stay with signed-in users. */
  isPublic: boolean;
}

/**
 * The avatar is a square shown as a circle. The cover is cut to the Т4 profile header (390 × 200), and kept whole: the
 * proposal card and the desktop profile are wider, and a narrow phone is taller. A listing photo is cut to the post
 * card (about 2:1). An event photo is cut to the catalog card (about 2:1) and kept whole, since the event page is
 * almost square. An organization's logo is a square shown as a circle.
 */
export const imageKinds: Record<ImageKind, ImageKindSettings> = {
  profilePhoto: { aspectRatio: 1, keepWhole: false, maxWidth: 512, maxHeight: 512, isPublic: false },
  profileCover: { aspectRatio: 390 / 200, keepWhole: true, maxWidth: 2560, maxHeight: 2560, isPublic: false },
  listingPhoto: { aspectRatio: 2, keepWhole: false, maxWidth: 1200, maxHeight: 600, isPublic: false },
  eventPhoto: { aspectRatio: 2, keepWhole: true, maxWidth: 2560, maxHeight: 2560, isPublic: true },
  organizationLogo: { aspectRatio: 1, keepWhole: false, maxWidth: 512, maxHeight: 512, isPublic: true },
};

interface Size {
  width: number;
  height: number;
}

/**
 * The crop in pixels, with exactly the kind's shape: the largest such area inside the one picked, around its centre.
 * Rounding in the client's preview never changes the stored shape.
 */
export function pixelCrop(crop: CropArea, picture: Size, aspectRatio: number): PixelArea {
  const picked = {
    left: crop.left * picture.width,
    top: crop.top * picture.height,
    width: crop.width * picture.width,
    height: crop.height * picture.height,
  };
  let width = Math.max(1, Math.round(Math.min(picked.width, picked.height * aspectRatio)));
  let height = Math.max(1, Math.round(width / aspectRatio));
  if (height > picture.height) {
    height = picture.height;
    width = Math.max(1, Math.round(height * aspectRatio));
  }
  if (width > picture.width) {
    width = picture.width;
    height = Math.max(1, Math.round(width / aspectRatio));
  }
  return centred(picked.left + picked.width / 2, picked.top + picked.height / 2, { width, height }, picture);
}

/** The same area in a copy of the picture scaled to another size. */
export function scaleArea(area: PixelArea, from: Size, to: Size): PixelArea {
  const scale = to.width / from.width;
  const width = Math.min(to.width, Math.max(1, Math.round(area.width * scale)));
  const height = Math.min(to.height, Math.max(1, Math.round(area.height * scale)));
  return centred((area.left + area.width / 2) * scale, (area.top + area.height / 2) * scale, { width, height }, to);
}

function centred(centreX: number, centreY: number, size: Size, picture: Size): PixelArea {
  return {
    left: clamp(Math.round(centreX - size.width / 2), 0, picture.width - size.width),
    top: clamp(Math.round(centreY - size.height / 2), 0, picture.height - size.height),
    width: size.width,
    height: size.height,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
