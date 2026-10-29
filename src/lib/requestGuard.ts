/**
 * Request guards for the public OTP/lead endpoints: origin check, body size limit,
 * client IP, and an in-memory sliding-window rate limiter.
 *
 * The limiter is per server instance. On Vercel each warm instance keeps its own counts,
 * so it bounds bursts rather than enforcing an exact global limit. Twilio Verify also
 * enforces its own per-number send limit and per-code attempt limit, and Fraud Guard.
 */
import { NextRequest } from "next/server";

/**
 * Browsers send Origin on POST. Allow the request's own host (the popup iframe calls its
 * own origin) and anything in ALLOWED_ORIGINS. Requests with no Origin (non-browser
 * clients) are allowed through to the rate limits — Origin cannot stop curl.
 */
export function isAllowedOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;

  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false; // includes the opaque "null" origin
  }

  const requestHost = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (originHost && originHost === requestHost) return true;

  const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, "").toLowerCase())
    .filter(Boolean);
  return allowed.includes(origin.replace(/\/$/, "").toLowerCase());
}

type JsonResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; status: number; error: string };

/** Parse a JSON object body, rejecting anything over maxBytes. */
export async function readJsonBody(req: NextRequest, maxBytes: number): Promise<JsonResult> {
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > maxBytes) return { ok: false, status: 413, error: "Request too large." };

  const text = await req.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    return { ok: false, status: 413, error: "Request too large." };
  }
  try {
    const data: unknown = JSON.parse(text);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { ok: false, status: 400, error: "Invalid request." };
    }
    return { ok: true, data: data as Record<string, unknown> };
  } catch {
    return { ok: false, status: 400, error: "Invalid request." };
  }
}

export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/* ── Rate limiting ── */

interface LimitRule {
  key: string;
  limit: number;
  windowMs: number;
}

const globalForLimits = globalThis as unknown as { __otpRateLimits?: Map<string, number[]> };
const hitsByKey = globalForLimits.__otpRateLimits ?? new Map<string, number[]>();
globalForLimits.__otpRateLimits = hitsByKey;

const SWEEP_THRESHOLD = 5000;
const MAX_WINDOW_MS = 60 * 60 * 1000;

function sweep(now: number) {
  if (hitsByKey.size < SWEEP_THRESHOLD) return;
  hitsByKey.forEach((hits, key) => {
    if (!hits.length || now - hits[hits.length - 1] > MAX_WINDOW_MS) hitsByKey.delete(key);
  });
}

/**
 * Check every rule first and consume from all of them only if all pass, so a request
 * rejected by one rule does not use up another's allowance.
 */
export function takeRateLimit(
  rules: LimitRule[],
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  let retryAfterSec = 0;

  const windows = rules.map((rule) => {
    const hits = (hitsByKey.get(rule.key) || []).filter((t) => now - t < rule.windowMs);
    if (hits.length >= rule.limit) {
      retryAfterSec = Math.max(retryAfterSec, Math.ceil((hits[0] + rule.windowMs - now) / 1000));
    }
    return { rule, hits };
  });

  if (retryAfterSec > 0) {
    windows.forEach(({ rule, hits }) => hitsByKey.set(rule.key, hits));
    return { ok: false, retryAfterSec: Math.max(1, retryAfterSec) };
  }

  windows.forEach(({ rule, hits }) => {
    hits.push(now);
    hitsByKey.set(rule.key, hits);
  });
  sweep(now);
  return { ok: true };
}

/** Give back the most recent hit on a key — used when a send fails before reaching Twilio. */
export function releaseRateLimit(key: string): void {
  const hits = hitsByKey.get(key);
  if (hits && hits.length) hits.pop();
}
