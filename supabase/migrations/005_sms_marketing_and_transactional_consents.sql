-- Migration to add separate marketing and transactional SMS consent columns.
alter table public.leads
  add column if not exists sms_marketing_consent_checked boolean not null default false,
  add column if not exists sms_marketing_consent_text text,
  add column if not exists sms_marketing_consent_at timestamptz,
  add column if not exists sms_transactional_consent_checked boolean not null default false,
  add column if not exists sms_transactional_consent_text text,
  add column if not exists sms_transactional_consent_at timestamptz;

comment on column public.leads.sms_marketing_consent_checked is 'Whether the user checked the marketing SMS consent checkbox.';
comment on column public.leads.sms_marketing_consent_text is 'Marketing consent disclosure text shown to the user.';
comment on column public.leads.sms_marketing_consent_at is 'Timestamp of the marketing SMS consent.';

comment on column public.leads.sms_transactional_consent_checked is 'Whether the user checked the transactional/2FA SMS consent checkbox.';
comment on column public.leads.sms_transactional_consent_text is 'Transactional/2FA SMS consent disclosure text shown to the user.';
comment on column public.leads.sms_transactional_consent_at is 'Timestamp of the transactional/2FA SMS consent.';

alter table public.popup_activity_tracker
  add column if not exists sms_marketing_consent_checked boolean not null default false,
  add column if not exists sms_marketing_consent_text text,
  add column if not exists sms_marketing_consent_at timestamptz,
  add column if not exists sms_transactional_consent_checked boolean not null default false,
  add column if not exists sms_transactional_consent_text text,
  add column if not exists sms_transactional_consent_at timestamptz;
