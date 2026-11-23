// Written with the help of Claude
/** Where an image is shown; each kind has its own crop shape and stored size (image-kinds.ts). */
export type ImageKind = 'profilePhoto' | 'profileCover' | 'listingPhoto' | 'eventPhoto' | 'organizationLogo';

/** An area of a picture in pixels. */
export interface PixelArea {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** An area of a picture as fractions of its width and height, 0 to 1, measured after EXIF rotation. */
export type CropArea = PixelArea;

export interface ImageUpload {
  content: Uint8Array;
  contentType: string;
  /** The area the user picked in the crop preview. */
  crop: CropArea;
}

/** What other modules keep and return of an image: never its bytes. */
export interface ImageRef {
  id: string;
  width: number;
  height: number;
  /** Set when the whole picture is kept (a cover): the area the user picked, in pixels of the stored image. */
  crop: PixelArea | null;
}

/** An image kept whole: always has its crop. */
export interface WholeImageRef extends ImageRef {
  crop: PixelArea;
}

export interface ImageFile {
  content: Uint8Array;
  contentType: string;
}

/** A new row as the repository stores it. */
export interface ImageRecord extends ImageFile, Omit<ImageRef, 'id'> {
  ownerId: string;
  /** A guest token may get it: a picture of the catalog, not of a person. */
  isPublic: boolean;
}

/** The picture the processor returns: encoded, and its size. */
export interface EncodedImage extends ImageFile {
  width: number;
  height: number;
}
