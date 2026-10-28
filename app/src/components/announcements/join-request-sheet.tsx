// Written with the help of Claude
// AI Usage: join request sheet from the Figma "Д4 Запит на оголошення" frame, on mock data; reviewed by Daryna Halytska.
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { mockJoinRequest } from '@/mocks/announcements';

type Props = {
  visible: boolean;
  // "Не цього разу" and the backdrop return to Т5.
  onClose: () => void;
  // "Прийняти" opens 07 Взаємний метч.
  onAccept: () => void;
};

export function JoinRequestSheet({ visible, onClose, onAccept }: Props) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text accessibilityRole="header" className="font-inter-bold text-h1 text-text-primary">
        Хоче піти з тобою
      </Text>
      <View className="flex-row items-center gap-3">
        <View className="size-[52px] items-center justify-center rounded-[26px] bg-brand-coral-soft">
          <Text className="font-inter-semibold text-h2 text-brand-coral">{mockJoinRequest.initial}</Text>
        </View>
        <View className="flex-1 gap-0.5">
          <Text numberOfLines={1} className="font-inter-medium text-body text-text-primary">
            {mockJoinRequest.nameAge}
          </Text>
          <Text numberOfLines={1} className="font-inter text-caption text-text-secondary">
            {mockJoinRequest.interests}
          </Text>
        </View>
      </View>
      <View className="gap-1.5 rounded-[20px] bg-surface-background px-4 py-3.5">
        <Text className="font-inter text-caption text-text-secondary">Твоє оголошення</Text>
        <Text className="font-inter text-body text-text-primary">{mockJoinRequest.post}</Text>
        <Text className="font-inter text-caption text-text-secondary">{mockJoinRequest.details}</Text>
      </View>
      <Text className="font-inter text-caption text-text-secondary">{mockJoinRequest.note}</Text>
      <Button label="Прийняти" onPress={onAccept} />
      <Button label="Не цього разу" variant="light" onPress={onClose} />
    </Sheet>
  );
}
