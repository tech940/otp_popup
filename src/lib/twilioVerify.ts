/**
 * Twilio Verify (v2) for the unlock popup's SMS OTP. Server-only — imported by API routes.
 *
 * Twilio generates, delivers, expires and rate-limits the codes; this app never sees or
 * stores one. Credentials come from server-side env vars only:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID (the "AM Ford" service, VA…)
 */
import twilio from "twilio";
import { maskPhone } from "@/lib/phone";

type TwilioClient = ReturnType<typeof twilio>;

let cachedClient: TwilioClient | null = null;

function config() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID?.trim() || "",
    authToken: process.env.TWILIO_AUTH_TOKEN?.trim() || "",
    serviceSid: process.env.TWILIO_VERIFY_SERVICE_SID?.trim() || "",
  };
}

export function isVerifyConfigured(): boolean {
  const c = config();
  return Boolean(c.accountSid && c.authToken && c.serviceSid);
}

function verifyService() {
  const c = config();
  if (!cachedClient) cachedClient = twilio(c.accountSid, c.authToken, { timeout: 10_000 });
  return cachedClient.verify.v2.services(c.serviceSid);
}

/** A failure that is safe to show the customer, with the HTTP status to return. */
export class VerifyError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly publicMessage: string,
  ) {
    super(publicMessage);
  }
}

const UNAVAILABLE = "Verification is temporarily unavailable. Please try again later.";

function twilioCode(e: unknown): number | undefined {
  const code = (e as { code?: unknown })?.code;
  return typeof code === "number" ? code : undefined;
}

/* Log the Twilio error code and a masked number only — never the code, token or full number. */
function logFailure(stage: "send" | "check", e: unknown, to: string) {
  console.warn(`[verify] ${stage} failed`, {
    twilioCode: twilioCode(e) ?? null,
    httpStatus: (e as { status?: unknown })?.status ?? null,
    to: maskPhone(to),
  });
}

/**
 * Start an SMS verification. Resolves when Twilio has accepted the request — that is not
 * confirmation of delivery, which Verify only reports asynchronously.
 */
export async function startSmsVerification(to: string): Promise<{ status: string }> {
  try {
    const v = await verifyService().verifications.create({ to, channel: "sms" });
    return { status: v.status };
  } catch (e) {
    logFailure("send", e, to);
    switch (twilioCode(e)) {
      case 60200: // invalid parameter (bad number)
        throw new VerifyError(400, "Please enter a valid US mobile number.");
      case 60205: // landline / not SMS capable
        throw new VerifyError(400, "This number can't receive text messages. Please use a mobile number.");
      case 60203: // Twilio's per-number send limit
        throw new VerifyError(429, "Too many codes have been requested for this number. Please wait 10 minutes and try again.");
      case 60410: // blocked by Fraud Guard
      case 60605: // geo permission
      case 60220:
        throw new VerifyError(400, "We can't send a code to this number. Please use a different US mobile number.");
      case 20429:
        throw new VerifyError(429, "We're receiving too many requests. Please wait a moment and try again.");
      case 20003: // auth
      case 20404: // service not found
      case 20008:
        throw new VerifyError(503, UNAVAILABLE);
      default:
        throw new VerifyError(502, "We couldn't send your code. Please try again.");
    }
  }
}

/** Check a code. `approved` is true only when Twilio returns status "approved". */
export async function checkVerification(
  to: string,
  code: string,
): Promise<{ approved: boolean; status: string }> {
  try {
    const check = await verifyService().verificationChecks.create({ to, code });
    return { approved: check.status === "approved", status: check.status };
  } catch (e) {
    logFailure("check", e, to);
    switch (twilioCode(e)) {
      case 20404: // no pending verification: expired, already used, or never sent
        throw new VerifyError(400, "This code has expired or was already used. Please request a new code.");
      case 60202: // max check attempts on this verification
        throw new VerifyError(429, "Too many incorrect attempts. Please request a new code.");
      case 60200:
        throw new VerifyError(400, "Enter the 6-digit code we sent.");
      case 20429:
        throw new VerifyError(429, "We're receiving too many requests. Please wait a moment and try again.");
      case 20003:
      case 20008:
        throw new VerifyError(503, UNAVAILABLE);
      default:
        throw new VerifyError(502, "We couldn't verify your code. Please try again.");
    }
  }
}

export const VERIFY_UNAVAILABLE_MESSAGE = UNAVAILABLE;
