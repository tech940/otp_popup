/**
 * OTP funnel tracking for the unlock popup (table public.otp_attempts, migration 006).
 *
 * Every person texted a code gets a row; it is marked verified when they enter the right
 * code. This is separate from leads: nothing here is emailed or counted as a lead.
 *
 * Tracking must never affect the customer: every function swallows its own errors, so a
 * missing table or a database outage only produces a log line.
 */
import { maskPhone } from "@/lib/phone";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const TABLE = "otp_attempts";
/* A resend within this window updates the same attempt rather than starting a new one. */
const SAME_ATTEMPT_WINDOW_MS = 30 * 60_000;

export interface AttemptDetails {
  firstName?: string;
  lastName?: string;
  email?: string;
  preferredContact?: string;
  comments?: string;
  vehicleTitle?: string;
  vin?: string;
  stock?: string;
  price?: string;
  source?: string;
  pageUrl?: string;
}

/* Values come straight from the browser: keep strings only, trimmed and length-capped. */
function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/** Pull the popup's form and vehicle fields out of a request body. Unknown keys are ignored. */
export function attemptDetailsFrom(body: Record<string, unknown>): AttemptDetails {
  const user = (body.user && typeof body.user === "object" ? body.user : {}) as Record<string, unknown>;
  const car = (body.car && typeof body.car === "object" ? body.car : {}) as Record<string, unknown>;
  return {
    firstName: text(user.firstName, 100) ?? undefined,
    lastName: text(user.lastName, 100) ?? undefined,
    email: text(user.email, 254) ?? undefined,
    preferredContact: text(user.preferredContact, 20) ?? undefined,
    comments: text(user.comments, 1000) ?? undefined,
    vehicleTitle: text(car.title, 200) ?? undefined,
    vin: text(car.vin, 20) ?? undefined,
    stock: text(car.stock, 40) ?? undefined,
    price: text(car.price, 40) ?? undefined,
    source: text(car.source, 100) ?? undefined,
    pageUrl: text(car.pageUrl, 2000) ?? undefined,
  };
}

function detailColumns(d: AttemptDetails) {
  return {
    first_name: d.firstName ?? null,
    last_name: d.lastName ?? null,
    email: d.email ?? null,
    preferred_contact: d.preferredContact ?? null,
    comments: d.comments ?? null,
    vehicle_title: d.vehicleTitle ?? null,
    vin: d.vin ?? null,
    stock: d.stock ?? null,
    price: d.price ?? null,
    source: d.source ?? null,
    page_url: d.pageUrl ?? null,
  };
}

function logFailure(stage: string, phone: string, error: unknown) {
  const e = error as { code?: unknown; message?: unknown };
  console.warn(`[otp-attempts] ${stage} failed`, {
    phone: maskPhone(phone),
    code: e?.code ?? null,
    message: typeof e?.message === "string" ? e.message.slice(0, 120) : null,
  });
}

/** The newest unverified attempt for this number inside the same-attempt window, if any. */
async function openAttempt(phone: string, windowMs: number) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { supabase: null, row: null };
  const since = new Date(Date.now() - windowMs).toISOString();
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, codes_sent")
    .eq("phone", phone)
    .eq("status", "code_sent")
    .gte("last_code_sent_at", since)
    .order("last_code_sent_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return { supabase, row: data && data[0] ? (data[0] as { id: string; codes_sent: number }) : null };
}

/** Called after Twilio accepts a send: start an attempt, or count a resend on the open one. */
export async function recordCodeSent(phone: string, details: AttemptDetails): Promise<void> {
  try {
    const { supabase, row } = await openAttempt(phone, SAME_ATTEMPT_WINDOW_MS);
    if (!supabase) return;
    const now = new Date().toISOString();

    if (row) {
      const { error } = await supabase
        .from(TABLE)
        .update({
          codes_sent: (row.codes_sent || 1) + 1,
          last_code_sent_at: now,
          updated_at: now,
          ...detailColumns(details),
        })
        .eq("id", row.id);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from(TABLE).insert({
      phone,
      status: "code_sent",
      codes_sent: 1,
      last_code_sent_at: now,
      ...detailColumns(details),
    });
    if (error) throw error;
  } catch (e) {
    logFailure("record code sent", phone, e);
  }
}

/** Called once Twilio approves the code: mark the open attempt verified. */
export async function recordVerified(phone: string): Promise<void> {
  try {
    /* A code stays valid for 10 minutes after the last send, so the window easily covers it. */
    const { supabase, row } = await openAttempt(phone, SAME_ATTEMPT_WINDOW_MS);
    if (!supabase || !row) return;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from(TABLE)
      .update({ status: "verified", verified_at: now, updated_at: now })
      .eq("id", row.id);
    if (error) throw error;
  } catch (e) {
    logFailure("record verified", phone, e);
  }
}
