// Written with the help of Claude
// AI Usage: join request sheet from the Figma "Д4 Запит на оголошення" frame; reviewed by Daryna Halytska. The API has no
// join requests yet, so only the gallery (/dev/components) shows it, with mock content.
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';

// Who asks to join, and the post they answer.
export type JoinRequest = {
  initial: string;
  nameAge: string;
  interests: string;
  post: string;
  details: string;
  note: string;
};

type Props = {
  visible: boolean;
  request: JoinRequest;
  // "Не цього разу" and the backdrop return to Т5.
  onClose: () => void;
  // "Прийняти" opens 07 Взаємний метч.
  onAccept: () => void;
};

export function JoinRequestSheet({ visible, request, onClose, onAccept }: Props) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text accessibilityRole="header" className="font-inter-bold text-h1 text-text-primary">
        Хоче піти з тобою
      </Text>
      <View className="flex-row items-center gap-3">
        <View className="size-[52px] items-center justify-center rounded-[26px] bg-brand-coral-soft">
          <Text className="font-inter-semibold text-h2 text-brand-coral">{request.initial}</Text>
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
      <Text className="font-inter text-caption text-text-secondary">{request.note}</Text>
      <Button label="Прийняти" onPress={onAccept} />
      <Button label="Не цього разу" variant="light" onPress={onClose} />
    </Sheet>
  );
}
