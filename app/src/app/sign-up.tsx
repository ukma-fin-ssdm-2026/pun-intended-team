// Written with the help of Claude
// AI Usage: placeholder for a screen of a later stage; reviewed by Daryna Halytska.
import { Stack } from 'expo-router';

import { ScreenPlaceholder } from '@/components/screen-placeholder';

export default function SignUpScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Реєстрація' }} />
      <ScreenPlaceholder title="В5 Реєстрація" withHeader />
    </>
  );
}
