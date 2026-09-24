-- MYCMO initial schema
-- Paste into Supabase SQL editor, or run `supabase db push`.
--
-- Tenancy model:
--   organizations  = one row per client business (the thing the dashboard is "for")
--   org_members    = which users can see which org, and in what role
--   profiles.is_agency_staff = your team; can see every org
--
-- Roles inside an org:
--   owner  -> client owner / CMO view. Sees everything, manages integrations and members.
--   rep    -> salesperson. Works leads and logs activity.
--   viewer -> read-only (e.g. a client's investor or bookkeeper).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type org_role as enum ('owner', 'rep', 'viewer');

create type lead_stage as enum (
  'new', 'attempted_contact', 'meeting_scheduled', 'proposal_sent', 'closed_won', 'closed_lost'
);

create type lead_source as enum ('door_knock', 'referral', 'web', 'phone', 'social', 'other');

create type activity_type as enum (
  'call', 'voicemail', 'door_knock', 'follow_up_scheduled', 'email', 'meeting', 'note', 'stage_change'
);

create type integration_provider as enum ('google', 'meta');

create type integration_status as enum ('pending_setup', 'connected', 'error', 'disconnected');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  is_agency_staff boolean not null default false,
  created_at timestamptz not null default now()
);

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,48}$'),
  logo_url text,
  created_at timestamptz not null default now()
);

create table org_members (
  org_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role org_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index on org_members (user_id);

create table leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  owner_id uuid references auth.users (id) on delete set null,
  name text not null,
  phone text,
  email text,
  company text,
  address text,
  source lead_source not null default 'other',
  stage lead_stage not null default 'new',
  estimated_value numeric(12, 2) not null default 0 check (estimated_value >= 0),
  lost_reason text,
  stage_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on leads (org_id, stage);
create index on leads (org_id, owner_id);

create table activities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  lead_id uuid references leads (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  type activity_type not null,
  notes text,
  due_at timestamptz,
  created_at timestamptz not null default now()
);
create index on activities (org_id, created_at desc);
create index on activities (lead_id, created_at desc);

create table huddle_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  huddle_date date not null default current_date,
  wins text,
  blockers text,
  focus text,
  created_at timestamptz not null default now()
);
create index on huddle_notes (org_id, huddle_date desc);

-- Monthly spend per channel, so the owner view can show cost per lead and ROI.
create table marketing_spend (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  channel text not null,
  month date not null check (extract(day from month) = 1),
  amount numeric(12, 2) not null check (amount >= 0),
  unique (org_id, channel, month)
);

-- One row per connected platform account. `config` holds which property/site/page was picked.
create table integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  provider integration_provider not null,
  status integration_status not null default 'pending_setup',
  account_label text,
  config jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  last_error text,
  connected_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, provider)
);

-- OAuth tokens live in their own table with NO client-facing policies.
-- Only the service role (server code) can read them. Values are AES-GCM encrypted by the app.
create table integration_secrets (
  integration_id uuid primary key references integrations (id) on delete cascade,
  access_token_enc text not null,
  refresh_token_enc text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Normalized daily metrics from every connector. The dashboard only ever reads this table,
-- so page loads never wait on (or burn quota against) Google/Meta APIs.
create table metric_snapshots (
  org_id uuid not null references organizations (id) on delete cascade,
  source text not null,          -- 'ga4' | 'gsc' | 'youtube' | 'facebook' | 'instagram' | ...
  metric text not null,          -- 'sessions' | 'clicks' | 'views' | 'reach' | ...
  day date not null,
  value numeric not null,
  updated_at timestamptz not null default now(),
  primary key (org_id, source, metric, day)
);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

create function touch_lead() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if new.stage is distinct from old.stage then
    new.stage_changed_at := now();
  end if;
  return new;
end $$;

create trigger leads_touch before update on leads
  for each row execute function touch_lead();

-- ---------------------------------------------------------------------------
-- RLS helpers (security definer avoids recursive policy evaluation on org_members)
-- ---------------------------------------------------------------------------
create function is_agency_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_agency_staff from profiles where id = auth.uid()), false)
$$;

create function org_role_of(p_org uuid) returns org_role
language sql stable security definer set search_path = public as $$
  select role from org_members where org_id = p_org and user_id = auth.uid()
$$;

create function can_view_org(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_agency_staff() or org_role_of(p_org) is not null
$$;

create function can_work_org(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_agency_staff() or org_role_of(p_org) in ('owner', 'rep')
$$;

create function can_manage_org(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_agency_staff() or org_role_of(p_org) = 'owner'
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table organizations enable row level security;
alter table org_members enable row level security;
alter table leads enable row level security;
alter table activities enable row level security;
alter table huddle_notes enable row level security;
alter table marketing_spend enable row level security;
alter table integrations enable row level security;
alter table integration_secrets enable row level security;  -- no policies: service role only
alter table metric_snapshots enable row level security;

-- profiles: see yourself, teammates in shared orgs, or everyone if agency staff.
create policy profiles_select on profiles for select using (
  id = auth.uid()
  or is_agency_staff()
  or exists (
    select 1 from org_members me join org_members them on me.org_id = them.org_id
    where me.user_id = auth.uid() and them.user_id = profiles.id
  )
);
-- is_agency_staff can only be flipped from the SQL editor / service role.
create policy profiles_update on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and is_agency_staff = is_agency_staff());

create policy orgs_select on organizations for select using (can_view_org(id));
create policy orgs_insert on organizations for insert with check (is_agency_staff());
create policy orgs_update on organizations for update using (can_manage_org(id));
create policy orgs_delete on organizations for delete using (is_agency_staff());

create policy members_select on org_members for select using (can_view_org(org_id));
create policy members_write on org_members for all
  using (can_manage_org(org_id)) with check (can_manage_org(org_id));

-- Leads: every member can read; owners and reps can write. Reps may only
-- modify leads they own or unassigned leads, owners can modify any.
create policy leads_select on leads for select using (can_view_org(org_id));
create policy leads_insert on leads for insert with check (can_work_org(org_id));
create policy leads_update on leads for update using (
  can_manage_org(org_id) or (can_work_org(org_id) and (owner_id = auth.uid() or owner_id is null))
) with check (can_work_org(org_id));
create policy leads_delete on leads for delete using (can_manage_org(org_id));

create policy activities_select on activities for select using (can_view_org(org_id));
create policy activities_insert on activities for insert
  with check (can_work_org(org_id) and user_id = auth.uid());
create policy activities_delete on activities for delete
  using (can_manage_org(org_id) or user_id = auth.uid());

create policy huddle_select on huddle_notes for select using (can_view_org(org_id));
create policy huddle_insert on huddle_notes for insert
  with check (can_work_org(org_id) and author_id = auth.uid());
create policy huddle_update on huddle_notes for update
  using (author_id = auth.uid() or can_manage_org(org_id));

create policy spend_select on marketing_spend for select using (can_view_org(org_id));
create policy spend_write on marketing_spend for all
  using (can_manage_org(org_id)) with check (can_manage_org(org_id));

create policy integrations_select on integrations for select using (can_view_org(org_id));
create policy integrations_write on integrations for all
  using (can_manage_org(org_id)) with check (can_manage_org(org_id));

-- Metrics are written by the sync job (service role); members only read.
create policy metrics_select on metric_snapshots for select using (can_view_org(org_id));
