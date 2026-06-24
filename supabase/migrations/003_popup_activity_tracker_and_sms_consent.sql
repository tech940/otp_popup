alter table public.leads
  add column if not exists sms_consent_checked boolean not null default false,
  add column if not exists sms_consent_text text,
  add column if not exists sms_consent_at timestamptz;

comment on column public.leads.sms_consent_checked is 'Whether the user explicitly checked the SMS consent checkbox.';
comment on column public.leads.sms_consent_text is 'Consent copy shown to the user at submission time.';
comment on column public.leads.sms_consent_at is 'Timestamp recorded when the user explicitly checked the SMS consent checkbox.';

create table if not exists public.popup_activity_tracker (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null default 'lead_submitted',
  popup_variant text not null,
  sms_consent_checked boolean not null default false,
  sms_consent_text text not null,
  sms_consent_at timestamptz,
  first_name text,
  last_name text,
  phone text,
  email text,
  page_url text,
  embed_source text,
  vehicle_title text,
  vin text,
  stock text,
  metadata jsonb not null default '{}'::jsonb
);

comment on table public.popup_activity_tracker is 'Submission and consent audit trail for instant price and offer popups.';
create index if not exists popup_activity_tracker_created_at_idx on public.popup_activity_tracker (created_at desc);
create index if not exists popup_activity_tracker_phone_idx on public.popup_activity_tracker (phone);
create index if not exists popup_activity_tracker_variant_idx on public.popup_activity_tracker (popup_variant);
