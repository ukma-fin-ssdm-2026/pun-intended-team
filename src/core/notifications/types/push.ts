// Written with the help of Claude
/** The most messages one `PushProvider.send` takes (HLD I5; Expo's own limit). */
export const PUSH_BATCH_LIMIT = 100;

/** One push to one device. */
export interface PushMessage {
  /** The device's push token. */
  to: string;
  title?: string;
  body: string;
  /** Given to the app when the user opens the push; never contact details. */
  data: Record<string, unknown>;
}

/**
 * What the provider said about one message: accepted, or refused with its code when it gives one (for Expo,
 * `DeviceNotRegistered` when the app was removed or its token changed).
 */
export type PushTicket = { status: 'ok' } | { status: 'error'; error?: string };
