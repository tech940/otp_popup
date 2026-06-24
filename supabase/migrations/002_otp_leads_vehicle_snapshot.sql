-- Optional: full Dealer Inspire `data-vehicle` JSON (and similar) for richer reporting.
alter table public.leads
  add column if not exists vehicle_snapshot jsonb;

comment on column public.leads.vehicle_snapshot is 'Raw vehicle object from embedder (e.g. data-vehicle JSON)';
