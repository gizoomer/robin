-- MYCMO 0003: WhatConverts connector and the Partner API.

-- WhatConverts authenticates with an API token + secret instead of OAuth.
-- The pair is stored encrypted in integration_secrets like any other token.
alter type integration_provider add value if not exists 'whatconverts';

-- ---------------------------------------------------------------------------
-- Partner apps: outside firms that push their own metrics into MYCMO.
-- The agency registers the app and the metrics it may send; each client's
-- admin then issues that app a key scoped to their account only.
-- ---------------------------------------------------------------------------
create table partner_apps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  website text,
  description text,
  contact_email text,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- The metrics an app is allowed to send. Anything else is rejected at the API.
create table partner_app_metrics (
  app_id uuid not null references partner_apps (id) on delete cascade,
  metric text not null check (metric ~ '^[a-z0-9_]{1,48}$'),
  label text not null,
  agg text not null default 'sum' check (agg in ('sum', 'avg', 'last')),
  format text check (format in ('number', 'money', 'decimal', 'percent')),
  primary key (app_id, metric)
);

-- One key per (app, client). Only a SHA-256 hash is stored; the key itself is
-- shown once when it is created.
create table partner_keys (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references partner_apps (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  key_prefix text not null unique,
  key_hash text not null,
  label text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index on partner_keys (org_id);

alter table partner_apps enable row level security;
alter table partner_app_metrics enable row level security;
alter table partner_keys enable row level security;

-- Any signed-in user can browse the app catalog; only agency staff edit it.
create policy apps_select on partner_apps for select using (auth.uid() is not null);
create policy apps_write on partner_apps for all using (is_agency_staff()) with check (is_agency_staff());
create policy app_metrics_select on partner_app_metrics for select using (auth.uid() is not null);
create policy app_metrics_write on partner_app_metrics for all using (is_agency_staff()) with check (is_agency_staff());

-- Keys belong to a client account: its admins (and agency staff) manage them.
create policy keys_select on partner_keys for select using (can_manage_org(org_id));
create policy keys_insert on partner_keys for insert with check (can_manage_org(org_id) and created_by = auth.uid());
create policy keys_update on partner_keys for update using (can_manage_org(org_id)) with check (can_manage_org(org_id));
