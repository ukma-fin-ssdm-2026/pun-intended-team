// Written with the help of Claude
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { call, publicClient } from '@/api/public-client';
import { startSession } from '@/api/session';
import { failureSnackbar } from '@/auth/messages';
import { useSnackbar } from '@/components/ui/snackbar';
import { useSignIn } from '@/hooks/use-sign-in';
import { startGoogleRegistration } from '@/state/google-registration';

// What a Google button does with the ID token: a known account signs in and opens the catalog, a new one goes to В5
// for the date of birth. `onLeave` runs before the screen changes, e.g. to close the guest dialog.
export function useGoogleAuth(onLeave?: () => void) {
  const router = useRouter();
  const openCatalog = useSignIn();
  const [loading, setLoading] = useState(false);
  const { snackbar, show, hide } = useSnackbar();

  const continueWithGoogle = useCallback(
    async function signIn(idToken: string): Promise<void> {
      hide();
      setLoading(true);
      const result = await call(() => publicClient.POST('/api/v1/auth/google', { body: { idToken } }));
      setLoading(false);
      if (result.ok) {
        await startSession(result.data);
        onLeave?.();
        openCatalog();
      } else if (result.status === 401) {
        // Not registered yet, or registration was left before the date of birth. An invalid token also ends up here;
        // В5 then reports it when it registers.
        startGoogleRegistration(idToken);
        onLeave?.();
        router.push('/sign-up');
      } else if (result.status === 429) {
        onLeave?.();
        router.push('/too-many-attempts');
      } else {
        show({ ...failureSnackbar(result), action: { label: 'Ще раз', onPress: () => void signIn(idToken) } });
      }
    },
    [hide, onLeave, openCatalog, router, show],
  );

  return { continueWithGoogle, loading, snackbar, showSnackbar: show };
}
