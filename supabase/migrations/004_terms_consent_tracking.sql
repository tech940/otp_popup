alter table public.leads
  add column if not exists terms_consent_checked boolean not null default false,
  add column if not exists terms_consent_text text,
  add column if not exists terms_consent_at timestamptz;

comment on column public.leads.terms_consent_checked is 'Whether the user explicitly checked the terms of use checkbox.';
comment on column public.leads.terms_consent_text is 'Terms of use copy shown to the user at submission time.';
comment on column public.leads.terms_consent_at is 'Timestamp recorded when the user explicitly checked the terms checkbox.';

alter table public.popup_activity_tracker
  add column if not exists terms_consent_checked boolean not null default false,
  add column if not exists terms_consent_text text,
  add column if not exists terms_consent_at timestamptz;
