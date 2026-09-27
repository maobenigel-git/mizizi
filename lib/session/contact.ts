/*
 * One canonical form per phone number or email, so "0712 345 678",
 * "+254712345678" and "254-712-345-678" are the same account.
 *
 * Kenyan numbers written locally (07… / 01…) are rewritten to +254. Anything
 * else with enough digits is kept as an international number. Returns
 * undefined for input that is neither, so the form can say so.
 */
export function normaliseContact(input: string): string | undefined {
  const value = input.trim();
  if (value.includes("@")) {
    const email = value.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : undefined;
  }
  const digits = value.replace(/[\s\-().]/g, "");
  if (!/^\+?\d+$/.test(digits)) return undefined;
  if (/^0[17]\d{8}$/.test(digits)) return `+254${digits.slice(1)}`;
  if (/^254[17]\d{8}$/.test(digits)) return `+${digits}`;
  const international = digits.startsWith("+") ? digits : `+${digits}`;
  return /^\+\d{8,15}$/.test(international) ? international : undefined;
}

export const PASSWORD_MIN_LENGTH = 8;
