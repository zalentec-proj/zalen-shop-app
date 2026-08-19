/**
 * Formats a Brazilian mobile or landline number for fields that accept a
 * national number. The server is still responsible for E.164 normalization.
 */
export function formatBrazilianPhone(value: string) {
  let digits = value.replace(/\D/g, '');

  // Preserve DDD 55. Only strip the country code if the pasted value has more
  // than the eleven digits permitted in a national Brazilian number.
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  digits = digits.slice(0, 11);

  if (digits.length <= 2) return digits ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
