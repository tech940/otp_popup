interface NormalizedPhone {
  digits: string;
  e164: string;
}

export function normalizePhone(input: string): NormalizedPhone {
  const digits = input.replace(/\D/g, "");
  if (!digits) {
    throw new Error("Phone number is required");
  }

  // If no country code is provided, prepend a configurable default.
  // Example: DEFAULT_COUNTRY_CODE=91 for India.
  const defaultCountryCode = (process.env.DEFAULT_COUNTRY_CODE || "").replace(/\D/g, "");
  const withCountryCode =
    defaultCountryCode && digits.length <= 10 ? `${defaultCountryCode}${digits}` : digits;

  if (withCountryCode.length < 8 || withCountryCode.length > 15) {
    throw new Error("Invalid phone number. Use full number with country code.");
  }

  return {
    digits: withCountryCode,
    e164: `+${withCountryCode}`,
  };
}

export class InvalidUsPhoneError extends Error {
  constructor() {
    super("Please enter a valid 10-digit US mobile number.");
  }
}

/**
 * Strict US (NANP) normalization for OTP verification. Accepts 10 digits, or 11 with a
 * leading 1, in any punctuation, and returns E.164 (+1XXXXXXXXXX). Area code and exchange
 * must start with 2-9. Throws InvalidUsPhoneError otherwise.
 *
 * Kept separate from normalizePhone(), which the offer/trade lead forms still use.
 */
export function normalizeUsPhone(input: unknown): string {
  if (typeof input !== "string" || input.length > 32) throw new InvalidUsPhoneError();
  let digits = input.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) throw new InvalidUsPhoneError();
  return `+1${digits}`;
}

/** "+1******4567" — for logs, which must never hold a full phone number. */
export function maskPhone(e164: string): string {
  return e164.length > 4 ? `+1******${e164.slice(-4)}` : "***";
}
