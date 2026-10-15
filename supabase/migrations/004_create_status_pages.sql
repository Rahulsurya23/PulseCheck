create table if not exists public.status_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  slug text not null unique,
  title text not null,
  description text,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists status_pages_user_created_at_idx
  on public.status_pages (user_id, created_at desc);

create table if not exists public.status_page_endpoints (
  id uuid primary key default gen_random_uuid(),
  status_page_id uuid not null references public.status_pages(id) on delete cascade,
  endpoint_id uuid not null references public.endpoints(id) on delete cascade,
  display_name text,
  sort_order integer not null default 0,
  unique (status_page_id, endpoint_id)
);

create index if not exists status_page_endpoints_page_sort_idx
  on public.status_page_endpoints (status_page_id, sort_order);
create index if not exists status_page_endpoints_endpoint_idx
  on public.status_page_endpoints (endpoint_id);

alter table public.status_pages enable row level security;
alter table public.status_page_endpoints enable row level security;

revoke all on public.status_pages, public.status_page_endpoints
  from anon, authenticated;
grant all on public.status_pages, public.status_page_endpoints
  to service_role;
