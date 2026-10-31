// Written with the help of Claude
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { googleSnackbars } from '@/auth/messages';
import type { GoogleButtonProps } from '@/components/auth/google-button';
import { Button } from '@/components/ui/button';
import { config } from '@/config';

// Google Identity Services gives an ID token only through its own button, so the web build draws Google's pill in the
// closest style to the Figma button: black on white surfaces, white on the gradient. Google caps its width at 400 px.
const MAX_WIDTH = 400;

export function GoogleButton({ variant, loading, onIdToken, onFailure }: GoogleButtonProps) {
  const container = useRef<View>(null);
  const [width, setWidth] = useState(0);
  const clientId = config.googleClientId;

  useEffect(() => {
    receiveIdToken = onIdToken;
  }, [onIdToken]);

  useEffect(() => {
    if (!clientId || loading || !width) return;
    let mounted = true;
    loadGoogle(clientId)
      .then((google) => {
        if (!mounted || !container.current) return;
        google.accounts.id.renderButton(container.current as unknown as HTMLElement, {
          theme: variant === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          logo_alignment: 'left',
          locale: 'uk',
          width: Math.min(width, MAX_WIDTH),
        });
      })
      .catch((error: unknown) => {
        console.warn(error);
        if (mounted) onFailure(googleSnackbars.other);
      });
    return () => {
      mounted = false;
    };
  }, [clientId, loading, onFailure, variant, width]);

  if (!clientId || loading) {
    return (
      <Button
        label="Продовжити з Google"
        variant={variant}
        loading={loading}
        onPress={() => onFailure(googleSnackbars.unavailable)}
      />
    );
  }
  // As tall as the Figma button, so the layout does not jump between the loading button and Google's 40 px pill.
  return (
    <View
      className="h-[52px] items-center justify-center"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <View ref={container} />
    </View>
  );
}

// Google's library stays on the page once loaded and must be initialised only once, so a screen mounted later only
// takes over where the ID token goes.
let google: Promise<GoogleIdentity> | undefined;
let receiveIdToken: (idToken: string) => void = () => {};

function loadGoogle(clientId: string): Promise<GoogleIdentity> {
  google ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => {
      const loaded = (window as unknown as { google: GoogleIdentity }).google;
      loaded.accounts.id.initialize({ client_id: clientId, callback: ({ credential }) => receiveIdToken(credential) });
      resolve(loaded);
    };
    script.onerror = () => {
      google = undefined;
      reject(new Error('Could not load Google sign-in'));
    };
    document.head.appendChild(script);
  });
  return google;
}

type GoogleIdentity = {
  accounts: {
    id: {
      initialize(options: { client_id: string; callback: (response: { credential: string }) => void }): void;
      renderButton(element: HTMLElement, options: Record<string, string | number>): void;
    };
  };
};
