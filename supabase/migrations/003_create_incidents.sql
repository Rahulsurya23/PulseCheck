create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.endpoints(id) on delete cascade,
  title text not null,
  status text not null default 'investigating'
    check (status in ('investigating', 'identified', 'monitoring', 'resolved')),
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists incidents_endpoint_started_at_idx
  on public.incidents (endpoint_id, started_at desc);

create table if not exists public.incident_updates (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  status text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists incident_updates_incident_created_at_idx
  on public.incident_updates (incident_id, created_at desc);

alter table public.incidents enable row level security;
alter table public.incident_updates enable row level security;

revoke all on public.incidents, public.incident_updates from anon, authenticated;
grant all on public.incidents, public.incident_updates to service_role;
