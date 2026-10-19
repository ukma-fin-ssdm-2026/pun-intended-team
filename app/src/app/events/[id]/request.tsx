// Written with the help of Claude
// AI Usage: placeholder for a screen of a later stage; reviewed by Daryna Halytska.
import { Stack } from 'expo-router';

import { ScreenPlaceholder } from '@/components/screen-placeholder';

export default function CompanyRequestScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Запит на компанію' }} />
      <ScreenPlaceholder title="03 Запит на компанію" withHeader />
    </>
  );
}
