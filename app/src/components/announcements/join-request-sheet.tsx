// Written with the help of Claude
// AI Usage: join request sheet from the Figma "Д4 Запит на оголошення" frame; reviewed by Daryna Halytska. Т5 opens it
// for a request from the API (joinRequestOf); the gallery (/dev/components) shows it with mock content.
import { Text, View } from 'react-native';

import type { ApiImage } from '@/api/images';
import { ApiPicture } from '@/components/pictures/picture';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';

// Who asks to join, and the post they answer.
export type JoinRequest = {
  initial: string;
  photo?: ApiImage | null;
  nameAge: string;
  interests: string;
  post: string;
  details: string;
  note: string;
};

type Props = {
  visible: boolean;
  request: JoinRequest;
  // The backdrop returns to Т5.
  onClose: () => void;
  // "Прийняти" opens 07 Взаємний метч.
  onAccept: () => void;
  // "Не цього разу" declines the request.
  onDecline: () => void;
  // The answer being sent.
  busy?: 'accept' | 'decline';
  // A request already answered shows this in place of the buttons.
  decided?: string;
};

export function JoinRequestSheet({ visible, request, onClose, onAccept, onDecline, busy, decided }: Props) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text accessibilityRole="header" className="font-inter-bold text-h1 text-text-primary">
        Хоче піти з тобою
      </Text>
      <View className="flex-row items-center gap-3">
        <View className="size-[52px] items-center justify-center overflow-hidden rounded-[26px] bg-brand-coral-soft">
          {request.photo ? (
            <ApiPicture image={request.photo} />
          ) : (
            <Text className="font-inter-semibold text-h2 text-brand-coral">{request.initial}</Text>
          )}
        </View>
        <View className="flex-1 gap-0.5">
          <Text numberOfLines={1} className="font-inter-medium text-body text-text-primary">
            {request.nameAge}
          </Text>
          <Text numberOfLines={1} className="font-inter text-caption text-text-secondary">
            {request.interests}
          </Text>
        </View>
      </View>
      <View className="gap-1.5 rounded-[20px] bg-surface-background px-4 py-3.5">
        <Text className="font-inter text-caption text-text-secondary">Твоє оголошення</Text>
        <Text className="font-inter text-body text-text-primary">{request.post}</Text>
        <Text className="font-inter text-caption text-text-secondary">{request.details}</Text>
      </View>
      {decided ? (
        <>
          <Text className="font-inter text-caption text-text-secondary">{decided}</Text>
          <Button label="Закрити" variant="light" onPress={onClose} />
        </>
      ) : (
        <>
          <Text className="font-inter text-caption text-text-secondary">{request.note}</Text>
          <Button label="Прийняти" loading={busy === 'accept'} disabled={busy !== undefined} onPress={onAccept} />
          <Button
            label="Не цього разу"
            variant="light"
            loading={busy === 'decline'}
            disabled={busy !== undefined}
            onPress={onDecline}
          />
        </>
      )}
    </Sheet>
  );
}
