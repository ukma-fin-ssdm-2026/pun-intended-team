// Written with the help of Claude
import { useRef } from 'react';
import { View } from 'react-native';

import GoogleMark from '@/assets/images/google-g.svg';
import { googleSnackbars } from '@/auth/messages';
import { requestGoogleIdToken } from '@/auth/google-sign-in';
import { Button } from '@/components/ui/button';
import type { SnackbarContent } from '@/components/ui/snackbar';

export type GoogleButtonProps = {
  // dark on white surfaces, light on the onboarding gradient.
  variant: 'dark' | 'light';
  // While the API checks the token.
  loading?: boolean;
  onIdToken: (idToken: string) => void;
  onFailure: (snackbar: SnackbarContent) => void;
};

// The large Figma button with Google's mark; on the dark button the mark sits on a white disc, as Google's guidelines
// ask. iOS and Android open Google's account picker; the web build has its own file.
export function GoogleButton({ variant, loading, onIdToken, onFailure }: GoogleButtonProps) {
  // The picker is open; a second tap would only report "in progress".
  const asking = useRef(false);

  const signIn = async () => {
    if (asking.current) return;
    asking.current = true;
    const result = await requestGoogleIdToken();
    asking.current = false;
    if (result.type === 'success') onIdToken(result.idToken);
    else if (result.type === 'unavailable') onFailure(googleSnackbars.unavailable);
    else if (result.type === 'failed') onFailure(googleSnackbars[result.reason]);
  };

  const mark =
    variant === 'dark' ? (
      <View className="size-7 items-center justify-center rounded-full bg-white">
        <GoogleMark width={20} height={20} />
      </View>
    ) : (
      <GoogleMark width={20} height={20} />
    );

  return <Button label="Продовжити з Google" variant={variant} loading={loading} leading={mark} onPress={signIn} />;
}
