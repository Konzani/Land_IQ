-- LandIQ backing tables. Run once in the Supabase SQL editor.
-- Everything here is optional: the app degrades to live fetches without it.

create table if not exists public.soil_cache (
  grid_id text primary key,
  payload jsonb not null,
  cached_at timestamptz not null default now()
);

create table if not exists public.climate_cache (
  grid_id text primary key,
  payload jsonb not null,
  cached_at timestamptz not null default now()
);

create table if not exists public.report_requests (
  id bigserial primary key,
  ip text not null,
  created_at timestamptz not null default now()
);

create index if not exists report_requests_ip_time on public.report_requests (ip, created_at desc);

-- Service-role only. No anon or authenticated policies are granted, so RLS
-- being enabled with zero policies is the intended lockdown.
alter table public.soil_cache enable row level security;
alter table public.climate_cache enable row level security;
alter table public.report_requests enable row level security;

create or replace function public.check_rate_limit(user_ip text, max_per_hour int default 20)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recent int;
begin
  delete from public.report_requests where created_at < now() - interval '2 hours';

  select count(*) into recent
  from public.report_requests
  where ip = user_ip and created_at > now() - interval '1 hour';

  if recent >= max_per_hour then
    return false;
  end if;

  insert into public.report_requests (ip) values (user_ip);
  return true;
end;
$$;
