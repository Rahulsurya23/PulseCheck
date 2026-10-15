create table if not exists public.endpoints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  url text not null,
  method text not null default 'GET',
  headers jsonb not null default '{}'::jsonb,
  body text,
  expected_status integer not null default 200,
  check_interval_seconds integer not null default 60,
  timeout_ms integer not null default 10000,
  retries integer not null default 2,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists endpoints_user_created_at_idx
  on public.endpoints (user_id, created_at desc);
create index if not exists endpoints_active_idx
  on public.endpoints (is_active)
  where is_active = true;

create table if not exists public.health_checks (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.endpoints(id) on delete cascade,
  status text not null check (status in ('up', 'down', 'degraded')),
  status_code integer,
  response_time_ms integer,
  error_message text,
  checked_at timestamptz not null default now()
);

create index if not exists health_checks_endpoint_checked_at_idx
  on public.health_checks (endpoint_id, checked_at desc);

create table if not exists public.alert_configs (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.endpoints(id) on delete cascade,
  type text not null check (type in ('email', 'webhook')),
  target text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists alert_configs_endpoint_active_idx
  on public.alert_configs (endpoint_id, is_active);

alter table public.endpoints enable row level security;
alter table public.health_checks enable row level security;
alter table public.alert_configs enable row level security;

revoke all on public.endpoints, public.health_checks, public.alert_configs
  from anon, authenticated;
grant all on public.endpoints, public.health_checks, public.alert_configs
  to service_role;
