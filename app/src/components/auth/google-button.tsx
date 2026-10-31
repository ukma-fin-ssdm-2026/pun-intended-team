// Written with the help of Claude
import { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';

import { config } from '@/config';

type Props = {
  // Google's own button texts: "Увійти через Google", "Зареєструватися через Google" or "Продовжити з Google".
  text: 'signin_with' | 'signup_with' | 'continue_with';
  onIdToken: (idToken: string) => void;
};

// Google Identity Services draws its own button, so it works in the web build only; on a phone it is not shown.
export function GoogleButton({ text, onIdToken }: Props) {
  const container = useRef<View>(null);

  useEffect(() => {
    const clientId = config.googleClientId;
    if (Platform.OS !== 'web' || !clientId) return;
    receiveIdToken = onIdToken;
    let mounted = true;
    loadGoogle(clientId)
      .then((google) => {
        if (!mounted) return;
        google.accounts.id.renderButton(container.current as unknown as HTMLElement, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text,
          locale: 'uk',
          width: 320,
        });
      })
      .catch((error: unknown) => console.warn(error));
    return () => {
      mounted = false;
    };
  }, [onIdToken, text]);

  if (Platform.OS !== 'web' || !config.googleClientId) return null;
  return (
    <View className="items-center">
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
