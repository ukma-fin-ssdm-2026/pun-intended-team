// Written with the help of Claude
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import {
  deleteProfileImage,
  uploadProfileImage,
  type ApiCoverImage,
  type ApiImage,
  type ProfileImageSlot,
} from '@/api/images';
import type { ApiResult } from '@/api/public-client';
import { ApiPicture, Picture } from '@/components/pictures/picture';
import { usePictureCropper } from '@/components/pictures/picture-cropper';
import { CoralGradient } from '@/components/ui/coral-gradient';
import { Glass } from '@/components/ui/glass';
import { Icon } from '@/components/ui/icon';
import { Sheet } from '@/components/ui/sheet';
import type { PictureKind } from '@/pictures/geometry';
import type { PictureDraft, PictureRefusal } from '@/pictures/picked-picture';
import { colors } from '@/styles/tokens';

/** The avatar or the cover as the form holds it: what is saved, and a change to save with the form. */
export type PictureField<T> = { saved: T | null; change?: PictureDraft | 'remove' };

export type ProfilePictures = { photo: PictureField<ApiImage>; cover: PictureField<ApiCoverImage> };

export function picturesOf(saved: { photo: ApiImage | null; cover: ApiCoverImage | null } | undefined) {
  return { photo: { saved: saved?.photo ?? null }, cover: { saved: saved?.cover ?? null } } satisfies ProfilePictures;
}

/** Sends the changed pictures once the profile exists; the first failure stops it. */
export async function savePictures(pictures: ProfilePictures): Promise<ApiResult<unknown> | undefined> {
  let result: ApiResult<unknown> | undefined;
  for (const slot of ['photo', 'cover'] as const) {
    const { change } = pictures[slot];
    if (!change) continue;
    result = change === 'remove' ? await deleteProfileImage(slot) : await uploadProfileImage(slot, change);
    if (!result.ok) return result;
  }
  return result;
}

function FieldPicture({ field }: { field: PictureField<ApiImage | ApiCoverImage> }) {
  const { change, saved } = field;
  if (change === 'remove') return null;
  if (change) return <Picture source={{ uri: change.picture.uri }} size={change.picture} crop={change.crop} />;
  return saved ? <ApiPicture image={saved} /> : null;
}

const shown = (field: PictureField<unknown>) => field.change !== 'remove' && !!(field.change || field.saved);

// On a phone the gallery opens only once the sheet's window has gone.
const SHEET_GONE_MS = 350;

type Props = {
  pictures: ProfilePictures;
  onChange: (pictures: ProfilePictures) => void;
  onRefused: (refusal: PictureRefusal) => void;
};

// "02 Фото": the cover with "Обкладинка", and the avatar overlapping its bottom 48 px. The default gradient and the
// camera show while there is no picture. Not in Figma: the sheet to replace or remove a picture.
export function ProfilePhoto({ pictures, onChange, onRefused }: Props) {
  // The slot stays while the sheet fades out, so its text does not change on the way.
  const [menu, setMenu] = useState<{ slot: ProfileImageSlot; open: boolean }>();
  const { start, cropper } = usePictureCropper((kind, draft) => {
    const slot = slotOf(kind);
    onChange({ ...pictures, [slot]: { ...pictures[slot], change: draft } });
  }, onRefused);
  const kindOf = { photo: 'profilePhoto', cover: 'profileCover' } as const;
  const open = (slot: ProfileImageSlot) =>
    shown(pictures[slot]) ? setMenu({ slot, open: true }) : void start(kindOf[slot]);
  const close = () => setMenu((current) => current && { ...current, open: false });

  return (
    <View className="px-5">
      <View className="h-[108px] items-end overflow-hidden rounded-[22px] pr-3 pt-3" style={{ marginBottom: -48 }}>
        {/* Light grey while the picture loads; the gradient only without one. */}
        <View className="absolute inset-0 bg-border-default">
          {shown(pictures.cover) ? <FieldPicture field={pictures.cover} /> : <CoralGradient preset="profileCover" />}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Змінити обкладинку" onPress={() => open('cover')}>
          <Glass
            className="flex-row items-center gap-1.5 py-[7px] pl-2.5 pr-3"
            radius={16}
            fill="rgba(255, 255, 255, 0.16)"
            border="rgba(255, 255, 255, 0.25)"
            tone="light"
          >
            <View className="flex-row items-center gap-1.5">
              <Icon name="gallery-edit" size={16} color={colors.text['on-dark']} />
              <Text className="font-inter-semibold text-tag text-text-on-dark">Обкладинка</Text>
            </View>
          </Glass>
        </Pressable>
      </View>
      <View className="flex-row pl-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Змінити фото профілю" onPress={() => open('photo')}>
          <View className="size-[92px] items-center justify-center overflow-hidden rounded-full border-4 border-surface-card bg-surface-background">
            {shown(pictures.photo) ? (
              <FieldPicture field={pictures.photo} />
            ) : (
              <Icon name="camera" size={28} color={colors.text.secondary} />
            )}
          </View>
          <View className="absolute left-16 top-16 size-[30px] items-center justify-center rounded-[15px] border-[3px] border-surface-card bg-brand-coral">
            <Text className="font-inter-semibold text-[18px] leading-6 text-text-on-dark">+</Text>
          </View>
        </Pressable>
      </View>

      {menu && (
        <Sheet visible={menu.open} onClose={close} gapClass="gap-1">
          <MenuRow
            label={menu.slot === 'cover' ? 'Обрати іншу обкладинку' : 'Обрати інше фото'}
            onPress={() => {
              // Gone at once rather than faded out, so it does not show behind the gallery.
              setMenu(undefined);
              // A browser opens the file dialog only straight from the tap.
              if (Platform.OS === 'web') void start(kindOf[menu.slot]);
              else setTimeout(() => void start(kindOf[menu.slot]), SHEET_GONE_MS);
            }}
          />
          <MenuRow
            label={menu.slot === 'cover' ? 'Прибрати обкладинку' : 'Прибрати фото'}
            destructive
            onPress={() => {
              onChange({ ...pictures, [menu.slot]: { ...pictures[menu.slot], change: 'remove' } });
              close();
            }}
          />
        </Sheet>
      )}
      {cropper}
    </View>
  );
}

function slotOf(kind: PictureKind): ProfileImageSlot {
  return kind === 'profilePhoto' ? 'photo' : 'cover';
}

function MenuRow({ label, destructive, onPress }: { label: string; destructive?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="py-3.5">
      <Text className={`font-inter-semibold text-label ${destructive ? 'text-brand-coral' : 'text-text-primary'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
