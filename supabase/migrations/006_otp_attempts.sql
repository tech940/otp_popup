-- Run this in the Supabase SQL Editor of the popup project (ehcmjypfxucvcvuofozx).
--
-- OTP funnel for the Instant Price unlock popup: one row per person who was texted a code,
-- whether or not they finished. Kept apart from public.leads on purpose — nothing here is
-- emailed or treated as a lead. It answers "how many people start but don't verify".
--
--   status = 'code_sent'  a code was sent and has not been verified (yet)
--   status = 'verified'   the person entered the correct code
--
-- A resend within 30 minutes updates the same row (codes_sent + 1) instead of adding one.

create table if not exists public.otp_attempts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'code_sent' check (status in ('code_sent', 'verified')),
  codes_sent integer not null default 1,
  last_code_sent_at timestamptz not null default now(),
  verified_at timestamptz,
  phone text not null,
  first_name text,
  last_name text,
  email text,
  preferred_contact text,
  comments text,
  vehicle_title text,
  vin text,
  stock text,
  price text,
  source text,
  page_url text
);

comment on table public.otp_attempts is
  'Unlock-popup OTP funnel: everyone sent a code, verified or not. Not leads; never emailed.';
comment on column public.otp_attempts.status is
  'code_sent = texted a code, not verified; verified = entered the correct code.';
comment on column public.otp_attempts.codes_sent is
  'Codes sent for this attempt, including resends within 30 minutes.';

create index if not exists otp_attempts_created_at_idx on public.otp_attempts (created_at desc);
create index if not exists otp_attempts_phone_idx on public.otp_attempts (phone, last_code_sent_at desc);
create index if not exists otp_attempts_status_idx on public.otp_attempts (status);

-- Holds personal details of people who did not finish: only the server (service role) may
-- read or write it. No policies are defined, so the public anon key gets nothing.
alter table public.otp_attempts enable row level security;
