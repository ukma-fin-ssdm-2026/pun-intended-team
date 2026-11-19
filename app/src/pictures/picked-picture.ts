// Written with the help of Claude
import * as ImagePicker from 'expo-image-picker';

import type { Area, Size } from './geometry';

/** A picture from the gallery, before it is uploaded. */
export type PickedPicture = Size & { uri: string; mimeType?: string };

/** A picture to upload and the area picked in the crop preview, in its pixels. */
export type PictureDraft = { picture: PickedPicture; crop: Area };

/**
 * The gallery, for one picture. `quality` re-encodes it as JPEG, which also turns an iPhone's HEIC into a type the API
 * takes. Undefined when the user closes the gallery.
 */
export async function pickPicture(): Promise<PickedPicture | undefined> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.85,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset || !asset.width || !asset.height) return undefined;
  return { uri: asset.uri, width: asset.width, height: asset.height, mimeType: asset.mimeType };
}
