// Written with the help of Claude
/** '+380501234501' -> '+380•••••4501', so logs never hold a full phone number. */
export function maskPhone(phone: string): string {
  return phone.slice(0, 4) + '•'.repeat(Math.max(phone.length - 8, 0)) + phone.slice(-4);
}
