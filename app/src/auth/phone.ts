// Written with the help of Claude

// "+380 67 123 45 67", "067 123 45 67" or "380671234567" → "+380671234567"; undefined for anything else.
export function toApiPhone(input: string): string | undefined {
  const digits = input.replace(/\D/g, '');
  const full = digits.length === 10 && digits.startsWith('0') ? `38${digits}` : digits;
  return /^380\d{9}$/.test(full) ? `+${full}` : undefined;
}

// "+380671234567" → "+380 •• ••• •• 67", as on В6.
export function maskPhone(phone: string): string {
  return `+380 •• ••• •• ${phone.slice(-2)}`;
}
