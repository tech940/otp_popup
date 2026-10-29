import { NextRequest, NextResponse } from "next/server";
import { InvalidUsPhoneError, normalizeUsPhone } from "@/lib/phone";
import {
  clientIp,
  isAllowedOrigin,
  readJsonBody,
  releaseRateLimit,
  takeRateLimit,
} from "@/lib/requestGuard";
import {
  VERIFY_UNAVAILABLE_MESSAGE,
  VerifyError,
  isVerifyConfigured,
  startSmsVerification,
} from "@/lib/twilioVerify";

/* Matches the popup's visible 30s "Resend in Ns" countdown. */
const RESEND_COOLDOWN_MS = 30_000;
const WINDOW_MS = 15 * 60_000;
const MAX_SENDS_PER_PHONE = 5;
const MAX_SENDS_PER_IP = 10;
const MAX_BODY_BYTES = 2_048;

const CORS = { "Access-Control-Allow-Origin": "*" };

function reply(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { ...CORS, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}

/**
 * POST { phone } -> send an SMS code through Twilio Verify.
 * 200 { success: true, status: "pending" } means Twilio accepted the request, not that the
 * message was delivered. Errors: { success: false, error, retryAfter? }.
 */
export async function POST(req: NextRequest) {
  if (!isAllowedOrigin(req)) return reply(403, { success: false, error: "Forbidden." });

  const body = await readJsonBody(req, MAX_BODY_BYTES);
  if (!body.ok) return reply(body.status, { success: false, error: body.error });

  let to: string;
  try {
    to = normalizeUsPhone(body.data.phone);
  } catch (e) {
    if (e instanceof InvalidUsPhoneError) return reply(400, { success: false, error: e.message });
    throw e;
  }

  if (!isVerifyConfigured()) {
    console.error("[verify] send-otp called but Twilio Verify env vars are not set");
    return reply(503, { success: false, error: VERIFY_UNAVAILABLE_MESSAGE });
  }

  const cooldownKey = `send:cooldown:${to}`;
  const limit = takeRateLimit([
    { key: cooldownKey, limit: 1, windowMs: RESEND_COOLDOWN_MS },
    { key: `send:phone:${to}`, limit: MAX_SENDS_PER_PHONE, windowMs: WINDOW_MS },
    { key: `send:ip:${clientIp(req)}`, limit: MAX_SENDS_PER_IP, windowMs: WINDOW_MS },
  ]);
  if (!limit.ok) {
    return reply(429, {
      success: false,
      error: `Please wait ${limit.retryAfterSec} seconds before requesting another code.`,
      retryAfter: limit.retryAfterSec,
    });
  }

  try {
    const { status } = await startSmsVerification(to);
    return reply(200, { success: true, status });
  } catch (e) {
    if (e instanceof VerifyError) {
      /* Twilio's own 5xx/outage: let the customer retry straight away rather than wait out
         the cooldown for a code that was never sent. The 15-minute counters still apply. */
      if (e.httpStatus >= 500) releaseRateLimit(cooldownKey);
      return reply(e.httpStatus, { success: false, error: e.publicMessage });
    }
    console.error("[verify] send-otp unexpected error", { name: (e as Error)?.name });
    return reply(500, { success: false, error: "We couldn't send your code. Please try again." });
  }
}
