// Written with the help of Claude
export type DeliveryChannel = 'telegram' | 'sms';

/** How a verification code went out, kept for delivery checks and cost tracking. */
export interface CodeDelivery {
  channel: DeliveryChannel;
  providerRequestId: string | null;
}
