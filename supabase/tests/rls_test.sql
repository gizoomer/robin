-- RLS permission tests. See README > Testing the database.
\set ON_ERROR_STOP 0
grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-00000000000a','agency@x'),('00000000-0000-0000-0000-00000000000b','owner@x'),
 ('00000000-0000-0000-0000-00000000000c','rep1@x'),('00000000-0000-0000-0000-00000000000d','rep2@x'),
 ('00000000-0000-0000-0000-00000000000e','viewer@x'),('00000000-0000-0000-0000-00000000000f','other@x');
update profiles set is_agency_staff = true where email='agency@x';
insert into organizations (id,name,slug) values ('10000000-0000-0000-0000-000000000001','Org1','org1'),('10000000-0000-0000-0000-000000000002','Org2','org2');
insert into org_members values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','owner'),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','rep'),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000d','rep'),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000e','viewer'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000f','owner');
insert into leads (id, org_id, owner_id, name, estimated_value) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','Rep1 lead',100),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000d','Rep2 lead',200);
insert into integrations (id, org_id, provider) values ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','google');
insert into integration_secrets values ('30000000-0000-0000-0000-000000000001','enc',null,null,now());

create or replace function t(label text, ok boolean) returns void language plpgsql as $$ begin raise notice '% %', case when ok then 'PASS' else 'FAIL' end, label; end $$;

set role authenticated;
-- outsider
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
select t('outsider sees 0 org1 leads', (select count(*) from leads where org_id='10000000-0000-0000-0000-000000000001') = 0);
select t('outsider sees only own org', (select count(*) from organizations) = 1);
-- rep1
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select t('rep sees both org1 leads', (select count(*) from leads) = 2);
with u as (update leads set stage='proposal_sent' where id='20000000-0000-0000-0000-000000000001' returning 1) select t('rep updates own lead', (select count(*) from u)=1);
with u as (update leads set stage='closed_won' where id='20000000-0000-0000-0000-000000000002' returning 1) select t('rep cannot update other rep lead', (select count(*) from u)=0);
select t('rep cannot read secrets', (select count(*) from integration_secrets)=0);
with u as (update profiles set is_agency_staff=true where id=auth.uid() returning 1) select 1;
select t('rep cannot self-promote', not (select is_agency_staff from profiles where id=auth.uid()));
insert into activities (org_id, lead_id, user_id, type) values ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001', auth.uid(),'call');
select t('rep can log activity', (select count(*) from activities)=1);
-- viewer
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
do $$ begin insert into leads (org_id, name) values ('10000000-0000-0000-0000-000000000001','x'); perform t('viewer cannot insert lead', false); exception when others then perform t('viewer cannot insert lead', true); end $$;
do $$ begin insert into integrations (org_id, provider) values ('10000000-0000-0000-0000-000000000001','meta'); perform t('viewer cannot connect', false); exception when others then perform t('viewer cannot connect', true); end $$;
-- owner
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
with u as (update leads set stage='closed_won' where id='20000000-0000-0000-0000-000000000002' returning 1) select t('owner updates any lead', (select count(*) from u)=1);
with u as (update integrations set status='connected' returning 1) select t('owner manages integrations', (select count(*) from u)=1);
select t('owner cannot read secrets', (select count(*) from integration_secrets)=0);
select t('owner sees teammate names', (select count(*) from profiles)=4);
-- agency
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select t('agency sees all orgs', (select count(*) from organizations)=2);
insert into organizations (name, slug) values ('Org3','org3');
select t('agency creates org', (select count(*) from organizations)=3);

-- 0002: KPI settings
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into org_kpis (org_id, source, metric, monthly_target) values ('10000000-0000-0000-0000-000000000001','ga4','sessions',1000);
select t('owner sets client KPIs', (select count(*) from org_kpis)=1);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select t('rep sees client KPIs', (select count(*) from org_kpis)=1);
do $$ begin insert into org_kpis (org_id, source, metric) values ('10000000-0000-0000-0000-000000000001','gsc','clicks'); perform t('rep cannot change KPIs', false); exception when others then perform t('rep cannot change KPIs', true); end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
select t('outsider cannot see KPIs', (select count(*) from org_kpis)=0);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into integrations (org_id, provider) values ('10000000-0000-0000-0000-000000000001','google_ads');
select t('owner connects Google Ads', (select count(*) from integrations where provider='google_ads')=1);
