// Written with the help of Claude
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSizes, spacing } from '@/styles/theme';

export function ErrorMessage({ message }: { message: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  text: { color: colors.danger, fontSize: fontSizes.md, textAlign: 'center' },
});
