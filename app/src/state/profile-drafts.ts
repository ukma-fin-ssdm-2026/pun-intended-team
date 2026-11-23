// Written with the help of Claude
import { File, Paths } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

// What the user entered and has not saved yet, per form (FR-004): profile setup, its contacts step, and the editor.
export type ProfileDraftKind = 'setup' | 'contacts' | 'edit';

const kinds: ProfileDraftKind[] = ['setup', 'contacts', 'edit'];
const SAVE_DELAY_MS = 300;

// A draft can outgrow the keychain's 2 KB per value, so it is a file; on the web, localStorage.
const storage =
  Platform.OS === 'web'
    ? {
        read: async (name: string) => (typeof localStorage === 'undefined' ? null : localStorage.getItem(name)),
        write: async (name: string, text: string) => localStorage.setItem(name, text),
        remove: async (name: string) => localStorage.removeItem(name),
      }
    : {
        read: async (name: string) => {
          const file = new File(Paths.document, name);
          return file.exists ? file.text() : null;
        },
        write: async (name: string, text: string) => new File(Paths.document, name).write(text),
        remove: async (name: string) => {
          const file = new File(Paths.document, name);
          if (file.exists) file.delete();
        },
      };

const nameOf = (kind: ProfileDraftKind) => `nearby-profile-draft-${kind}.json`;

export async function loadProfileDraft<T extends object>(kind: ProfileDraftKind): Promise<Partial<T> | undefined> {
  try {
    const text = await storage.read(nameOf(kind));
    const draft: unknown = text ? JSON.parse(text) : undefined;
    return draft && typeof draft === 'object' ? (draft as Partial<T>) : undefined;
  } catch {
    return undefined;
  }
}

export async function clearProfileDraft(kind: ProfileDraftKind) {
  await storage.remove(nameOf(kind)).catch(() => undefined);
}

// On sign-out, so a draft never reaches another account.
export async function clearProfileDrafts() {
  await Promise.all(kinds.map(clearProfileDraft));
}

// The stored draft, read once; `drop` deletes it and bumps `version`, which remounts the form from its defaults.
export function useStoredProfileDraft<T extends object>(kind: ProfileDraftKind) {
  const [state, setState] = useState<{ loaded: boolean; draft?: Partial<T>; version: number }>({
    loaded: false,
    version: 0,
  });

  useEffect(() => {
    let current = true;
    void loadProfileDraft<T>(kind).then((draft) => {
      if (current) setState((previous) => ({ ...previous, loaded: true, draft }));
    });
    return () => {
      current = false;
    };
  }, [kind]);

  const drop = useCallback(() => {
    void clearProfileDraft(kind);
    setState(({ version }) => ({ loaded: true, draft: undefined, version: version + 1 }));
  }, [kind]);

  return { ...state, drop };
}

/**
 * Saves `values` as the draft shortly after each change, and at once when the form closes or the app leaves the
 * foreground; `unchanged` values remove it instead. Returns `discard`, called after a successful save.
 */
export function useProfileDraft<T>(kind: ProfileDraftKind, values: T, unchanged: boolean) {
  const latest = useRef({ values, unchanged });
  const discarded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Declared first, so the effects below read this render's values.
  useEffect(() => {
    latest.current = { values, unchanged };
  });

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (discarded.current) return;
    const { values: draft, unchanged: empty } = latest.current;
    void (empty ? clearProfileDraft(kind) : storage.write(nameOf(kind), JSON.stringify(draft)).catch(() => undefined));
  }, [kind]);

  const serialized = JSON.stringify(values);
  useEffect(() => {
    discarded.current = false;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }, [serialized, flush]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') flush();
    });
    return () => {
      subscription.remove();
      flush();
    };
  }, [flush]);

  return useCallback(() => {
    clearTimeout(timer.current);
    discarded.current = true;
    void clearProfileDraft(kind);
  }, [kind]);
}

// The snackbar shown over a restored draft.
export const restoredDraftSnackbar = (onReset: () => void) => ({
  title: 'Повернули чернетку',
  note: 'Незбережені зміни знову у формі',
  action: { label: 'Скинути', onPress: onReset },
});
