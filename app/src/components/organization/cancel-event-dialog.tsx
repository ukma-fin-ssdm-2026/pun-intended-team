// Written with the help of Claude
// AI Usage: cancel event dialog from the Figma "DО3 Організація · Скасувати подію" desktop frame; the О3 sheet it
// replaces was reviewed by Daryna Halytska.
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Overlay } from '@/components/ui/overlay';
import { colors } from '@/styles/tokens';

const consequences: { icon: IconName; text: string }[] = [
  { icon: 'bell', text: 'Усі, хто шукає компанію, отримають сповіщення' },
  { icon: 'matches', text: 'Пошук компанії на цю подію буде зупинено' },
  { icon: 'home', text: 'Подія зникне з каталогу і мапи' },
];

// "01 Модальне вікно": 520 px wide, its Figma DROP_SHADOW as CSS.
const DIALOG_SHADOW = '0px 24px 32px rgba(0, 0, 0, 0.25)';

type Props = {
  visible: boolean;
  // The event's short name, as in "Скасувати «Джаз-вечір»?".
  eventName: string;
  // "Так, скасувати подію", "Залишити" and the backdrop all return to О1 in the prototype.
  onClose: () => void;
  // Cancels a real event; without it "Так, скасувати подію" only closes the dialog, as in the prototype.
  onConfirm?: () => void;
  // The request is running: the buttons wait.
  loading?: boolean;
  // Why the API refused, shown above the buttons.
  error?: string;
};

export function CancelEventDialog({ visible, eventName, onClose, onConfirm, loading = false, error }: Props) {
  return (
    <Overlay visible={visible} onClose={loading ? () => {} : onClose} placement="center">
      <View accessibilityViewIsModal className="w-full max-w-[520px] self-center">
        <View className="gap-5 rounded-[28px] bg-surface-card px-5 pb-6 pt-3" style={{ boxShadow: DIALOG_SHADOW }}>
          <View className="items-center gap-2.5">
            <View className="size-14 items-center justify-center rounded-full bg-brand-coral">
              <Icon name="danger" size={26} color={colors.text['on-dark']} />
            </View>
            <Text accessibilityRole="header" className="text-center font-inter-bold text-h1 text-text-primary">
              Скасувати «{eventName}»?
            </Text>
            <Text className="text-center font-inter text-caption text-text-secondary">
              Цю дію не можна скасувати. Ось що станеться:
            </Text>
          </View>

          <View className="rounded-[20px] bg-surface-background px-4 py-1">
            {consequences.map((item, index) => (
              <View key={item.icon}>
                {index > 0 && <View className="h-px bg-border-default" />}
                <View className="flex-row items-center gap-3 py-3">
                  <View className="size-9 items-center justify-center rounded-[11px] bg-surface-card">
                    <Icon name={item.icon} size={18} />
                  </View>
                  <Text className="flex-1 font-inter text-body text-text-primary">{item.text}</Text>
                </View>
              </View>
            ))}
          </View>

          {error && (
            <Text accessibilityRole="alert" className="text-center font-inter text-caption text-brand-coral">
              {error}
            </Text>
          )}
          <Button label="Так, скасувати подію" loading={loading} onPress={onConfirm ?? onClose} />
          <Button label="Залишити" variant="light" disabled={loading} onPress={onClose} />
        </View>
      </View>
    </Overlay>
  );
}
