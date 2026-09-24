-- MYCMO 0002: per-client KPI setup, ad platform connectors, client status.

-- Ad platforms get their own OAuth grant so a client can connect ads without
-- handing over analytics, and vice versa.
alter type integration_provider add value if not exists 'google_ads';
alter type integration_provider add value if not exists 'meta_ads';

-- Which KPIs each client sees at the top of their dashboard, in what order,
-- and the monthly goal the agency set for each.
create table org_kpis (
  org_id uuid not null references organizations (id) on delete cascade,
  source text not null,
  metric text not null,
  position int not null default 0,
  monthly_target numeric check (monthly_target is null or monthly_target >= 0),
  primary key (org_id, source, metric)
);

alter table org_kpis enable row level security;
create policy kpis_select on org_kpis for select using (can_view_org(org_id));
create policy kpis_write on org_kpis for all
  using (can_manage_org(org_id)) with check (can_manage_org(org_id));

-- Lets the agency keep paused/offboarded clients without deleting their history.
alter table organizations add column if not exists status text not null default 'active'
  check (status in ('active', 'paused', 'archived'));
alter table organizations add column if not exists industry text;
