// Written with the help of Claude
// AI Usage: sign-in navigation of the Figma auth flow; reviewed by Daryna Halytska.
import { useRouter } from 'expo-router';

import { signIn } from '@/state/session';

// Signing in starts a new history on the catalog, so back cannot return to the sign-in screens.
export function useSignIn() {
  const router = useRouter();
  return () => {
    signIn();
    // From В3 itself there is nothing to dismiss.
    if (router.canDismiss()) router.dismissAll();
    router.replace('/');
  };
}
