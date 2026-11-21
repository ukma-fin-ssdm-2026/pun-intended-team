// Written with the help of Claude
import * as ImagePicker from 'expo-image-picker';

import type { Area, Size } from './geometry';

// The API's limit.
const MAX_PICTURE_BYTES = 10 * 1024 * 1024;

/** A picture from the gallery, before it is uploaded; `type` is read from its bytes, which are not kept in state. */
export type PickedPicture = Size & { uri: string; type: PictureType };

/** A picture to upload and the area picked in the crop preview, in its pixels. */
export type PictureDraft = { picture: PickedPicture; crop: Area };

type PictureType = 'image/jpeg' | 'image/png' | 'image/webp';

/** Why a picked file cannot be used. */
export type PictureRefusal = 'unsupported' | 'too-large';

/**
 * The gallery, for one picture. On an iPhone `quality` re-encodes it as JPEG, which turns HEIC into a type the API
 * takes; a file of another type, as a browser or an Android phone can give, is refused here, before the preview.
 * Undefined when the user closes the gallery.
 */
export async function pickPicture(): Promise<PickedPicture | PictureRefusal | undefined> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.85,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return undefined;
  if (!asset.width || !asset.height) return 'unsupported';
  const bytes = await readPictureBytes(asset.uri).catch(() => undefined);
  if (!bytes) return 'unsupported';
  if (bytes.byteLength > MAX_PICTURE_BYTES) return 'too-large';
  const type = pictureType(bytes);
  if (!type) return 'unsupported';
  return { uri: asset.uri, width: asset.width, height: asset.height, type };
}

/** The file of a picked picture: a local file on a phone, a blob URL in a browser. */
export async function readPictureBytes(uri: string): Promise<Uint8Array> {
  return new Uint8Array(await (await fetch(uri)).arrayBuffer());
}

const ascii = (bytes: Uint8Array, from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));

/** The type by the file's signature, not by its name or the type the gallery reports. */
export function pictureType(bytes: Uint8Array): PictureType | undefined {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (ascii(bytes, 0, 8) === '\x89PNG\r\n\x1a\n') return 'image/png';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'image/webp';
  return undefined;
}
