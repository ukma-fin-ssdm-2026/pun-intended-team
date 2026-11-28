// Written with the help of Claude
// AI Usage: modal layer with the Figma backdrop for dialogs and sheets; reviewed by Daryna Halytska.
import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { useIsDesktop } from '@/hooks/use-is-desktop';
import { desktop } from '@/styles/tokens';

type Props = {
  visible: boolean;
  // Backdrop tap, the Android back button and Esc in a browser; in Figma the backdrop goes back.
  onClose: () => void;
  // center = dialog ("01 Вікно"), bottom = sheet ("01 Шторка"). On a desktop both are centered dialogs.
  placement: 'center' | 'bottom';
  // The dialog's width on a desktop, for one wider than the usual dialog or sheet.
  desktopWidth?: number;
  children: ReactNode;
};

export function Overlay({ visible, onClose, placement, desktopWidth, children }: Props) {
  const isDesktop = useIsDesktop();
  const sheet = placement === 'bottom';

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View
        className={`flex-1 ${
          isDesktop ? 'items-center justify-center px-5 py-10' : sheet ? 'justify-end' : 'justify-center px-5'
        }`}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Закрити"
          onPress={onClose}
          className="absolute inset-0 bg-[rgba(18,18,18,0.6)]"
        />
        {isDesktop ? (
          // A sheet's own corners are rounded at the top only; as a dialog it is rounded all round.
          <View
            className={`max-h-full max-w-full ${sheet ? 'overflow-hidden rounded-[28px]' : ''}`}
            style={{ width: desktopWidth ?? (sheet ? desktop.sheetWidth : desktop.dialogWidth) }}
          >
            {children}
          </View>
        ) : (
          children
        )}
      </View>
    </Modal>
  );
}
