// Written with the help of Claude
// The Google ID token of an account that is new to Nearby, from the Google button to В5. Kept in memory only: Google's
// tokens are valid for an hour, and a restarted app starts again from the button.
let pendingIdToken: string | undefined;

export function startGoogleRegistration(idToken: string) {
  pendingIdToken = idToken;
}

export function googleRegistrationToken(): string | undefined {
  return pendingIdToken;
}

export function finishGoogleRegistration() {
  pendingIdToken = undefined;
}

// Name and email from the token, only to show which Google account is registering; the API checks the token itself.
export function googleProfile(idToken: string): { name?: string; email?: string } {
  try {
    const payload = idToken.split('.')[1].replaceAll('-', '+').replaceAll('_', '/');
    const bytes = atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='));
    // atob gives one character per byte; names are UTF-8.
    const json = decodeURIComponent(
      Array.from(bytes, (char) => `%${(char.codePointAt(0) ?? 0).toString(16).padStart(2, '0')}`).join(''),
    );
    const { name, email } = JSON.parse(json) as { name?: string; email?: string };
    return { name, email };
  } catch {
    return {};
  }
}
