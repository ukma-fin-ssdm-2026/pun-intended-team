// Written with the help of Claude
export type Size = { width: number; height: number };
export type Area = Size & { left: number; top: number };

// Where each picture is shown, and the shape its crop has; the API cuts uploads to the same shapes.
export type PictureKind = 'profilePhoto' | 'profileCover' | 'listingPhoto';

export const aspectRatios: Record<PictureKind, number> = {
  profilePhoto: 1,
  // The cover of "01.1 Обкладинка" on Т4.
  profileCover: 390 / 200,
  // The photo of a post in "03.3 Допис", 294 × 150.
  listingPhoto: 2,
};

export function wholeArea({ width, height }: Size): Area {
  return { left: 0, top: 0, width, height };
}

/**
 * The part of the picture a box of another shape shows: all of the crop, with more of the picture beside it, or above
 * and below it, where the picture has it. Only when the picture runs out is the crop cut, around its centre.
 */
export function visibleArea(picture: Size, crop: Area, boxRatio: number): Area {
  let width: number;
  let height: number;
  if (boxRatio >= crop.width / crop.height) {
    height = crop.height;
    width = height * boxRatio;
    if (width > picture.width) {
      width = picture.width;
      height = width / boxRatio;
    }
  } else {
    width = crop.width;
    height = width / boxRatio;
    if (height > picture.height) {
      height = picture.height;
      width = height * boxRatio;
    }
  }
  return {
    left: clamp(crop.left + crop.width / 2 - width / 2, 0, picture.width - width),
    top: clamp(crop.top + crop.height / 2 - height / 2, 0, picture.height - height),
    width,
    height,
  };
}

/** An area in pixels as fractions of the picture, as the upload endpoints take it. */
export function toFractions(area: Area, picture: Size): Area {
  return {
    left: clamp(area.left / picture.width, 0, 1),
    top: clamp(area.top / picture.height, 0, 1),
    width: clamp(area.width / picture.width, 0, 1),
    height: clamp(area.height / picture.height, 0, 1),
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
