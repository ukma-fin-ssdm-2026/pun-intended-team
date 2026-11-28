// Written with the help of Claude
// No desktop frame in Figma; layout derived from 567:7083 (DД1 Фільтри): the sheet is a centered dialog.
import { Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Overlay } from '@/components/ui/overlay';
import { SheetHandle, useSheetEntering, useSheetPadding } from '@/components/ui/sheet';
import { colors } from '@/styles/tokens';

const steps: { icon: IconName; title: string; note: string }[] = [
  {
    icon: 'clock',
    title: 'Підбираємо пари кілька разів',
    note: 'За тиждень, за три дні, за добу і за 6 годин до події ми зводимо в пари всіх, хто на неї чекає',
  },
  {
    icon: 'heart',
    title: 'Враховуємо інтереси',
    note: 'Ми підберемо тобі метч зі схожими інтересами та побажаннями',
  },
  {
    icon: 'matches',
    title: 'Надсилаємо пропозицію',
    note: 'Ти і твій метч отримаєте повідомлення, коли ми вас поєднаємо. Протягом доби потрібно погодитися або відмовитися',
  },
  {
    icon: 'search',
    title: 'Якщо ти або твій метч відмовилися',
    note: 'Нічого страшного! Ми знайдемо тобі когось нового в наступному підборі',
  },
];

export function RoundsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const entering = useSheetEntering();
  const padding = useSheetPadding();

  return (
    <Overlay visible={visible} onClose={onClose} placement="bottom">
      <Animated.View entering={entering} accessibilityViewIsModal>
        <View className="gap-5 rounded-t-[28px] bg-surface-card px-5 pt-3" style={padding}>
          <SheetHandle />

          <View className="items-center gap-3">
            <View className="size-14 items-center justify-center rounded-full bg-brand-coral">
              <Icon name="clock" size={26} color={colors.text['on-dark']} />
            </View>
            <Text accessibilityRole="header" className="text-center font-inter-bold text-h1 text-text-primary">
              Як ми шукаємо тобі компанію
            </Text>
          </View>

          <View className="gap-4">
            {steps.map((step) => (
              <View key={step.title} className="flex-row items-center gap-3.5">
                <View className="size-10 items-center justify-center rounded-xl bg-surface-background">
                  <Icon name={step.icon} size={20} />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="font-inter-medium text-body text-text-primary">{step.title}</Text>
                  <Text className="font-inter text-caption text-text-secondary">{step.note}</Text>
                </View>
              </View>
            ))}
          </View>

          <Button label="Зрозуміло" variant="dark" onPress={onClose} />
        </View>
      </Animated.View>
    </Overlay>
  );
}
