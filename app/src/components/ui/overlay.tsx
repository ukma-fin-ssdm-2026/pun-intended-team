// Written with the help of Claude
// AI Usage: modal layer with the Figma backdrop for dialogs and sheets; reviewed by Daryna Halytska.
import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';

type Props = {
  visible: boolean;
  // Backdrop tap and the Android back button; in Figma the backdrop goes back.
  onClose: () => void;
  // center = dialog ("01 Вікно"), bottom = sheet ("01 Шторка").
  placement: 'center' | 'bottom';
  children: ReactNode;
};

export function Overlay({ visible, onClose, placement, children }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View className={`flex-1 ${placement === 'center' ? 'justify-center px-5' : 'justify-end'}`}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Закрити"
          onPress={onClose}
          className="absolute inset-0 bg-[rgba(18,18,18,0.6)]"
        />
        {children}
      </View>
    </Modal>
  );
}
