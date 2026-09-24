import type { SupabaseClient } from '@supabase/supabase-js';
import { buildTiles, pipelineStats, repStats } from '$lib/dashboard';
import { AD_SPEND_SOURCES, type AppSourceId, type MetricDef } from '$lib/metrics';
import { kpiProgress } from '$lib/portfolio';

/**
 * Everything the client overview shows. Shared by the dashboard page and the
 * AI assistant, so the assistant answers from exactly the numbers on screen.
 * Runs through the caller's RLS-scoped client.
 */
export async function loadOverview(supabase: SupabaseClient, org: { id: string }) {
	const since60 = new Date(Date.now() - 62 * 86400_000).toISOString().slice(0, 10);
	const since7 = new Date(Date.now() - 7 * 86400_000).toISOString();
	const since90 = new Date(Date.now() - 90 * 86400_000);
	const spendFrom = new Date(Date.UTC(since90.getUTCFullYear(), since90.getUTCMonth(), 1)).toISOString().slice(0, 10);

	const [snapshots, leads, activities, members, spend, huddle, kpis, adSpend] = await Promise.all([
		supabase.from('metric_snapshots').select('source, metric, day, value').eq('org_id', org.id).gte('day', since60),
		supabase.from('leads').select('owner_id, stage, estimated_value, created_at, stage_changed_at').eq('org_id', org.id),
		supabase.from('activities').select('user_id').eq('org_id', org.id).gte('created_at', since7),
		supabase.from('org_members').select('user_id').eq('org_id', org.id),
		supabase.from('marketing_spend').select('amount, month').eq('org_id', org.id).gte('month', spendFrom),
		supabase.from('huddle_notes').select('huddle_date, wins, blockers, focus').eq('org_id', org.id).order('huddle_date', { ascending: false }).limit(1),
		supabase.from('org_kpis').select('source, metric, position, monthly_target').eq('org_id', org.id),
		supabase.from('metric_snapshots').select('value').eq('org_id', org.id).eq('metric', 'spend').in('source', AD_SPEND_SOURCES).gte('day', spendFrom)
	]);

	const allLeads = leads.data ?? [];
	const actCounts = new Map<string, number>();
	for (const a of activities.data ?? []) if (a.user_id) actCounts.set(a.user_id, (actCounts.get(a.user_id) ?? 0) + 1);
	// org_members has no FK to profiles (both point at auth.users), so look names up separately.
	const ids = [...new Set([...(members.data ?? []).map((m) => m.user_id), ...actCounts.keys()])];
	const { data: profiles } = ids.length
		? await supabase.from('profiles').select('id, full_name').in('id', ids)
		: { data: [] };
	const names = new Map<string, string>((profiles ?? []).map((p) => [p.id, p.full_name ?? 'Team member']));

	// ROI over the spend window: revenue from deals won since the window opened vs. spend in it.
	// Manual spend (retainers, print, ...) plus ad spend synced from Google Ads / Meta Ads.
	const adTotal = (adSpend.data ?? []).reduce((a, s) => a + Number(s.value), 0);
	const totalSpend = (spend.data ?? []).reduce((a, s) => a + Number(s.amount), 0) + adTotal;
	const windowLeads = allLeads.filter((l) => l.created_at >= spendFrom);
	const windowWon = allLeads
		.filter((l) => l.stage === 'closed_won' && l.stage_changed_at >= spendFrom)
		.reduce((a, l) => a + Number(l.estimated_value), 0);

	// Partner apps (Partner API) report under "app:<slug>"; pull their metric labels so they show like built-ins.
	const appSlugs = [...new Set((snapshots.data ?? []).map((r) => r.source).filter((s) => s.startsWith('app:')).map((s) => s.slice(4)))];
	const { data: appDefs } = appSlugs.length
		? await supabase.from('partner_app_metrics').select('metric, label, agg, format, app:partner_apps!inner(slug, name)').in('app.slug', appSlugs)
		: { data: [] };
	const appSources: Record<string, string> = {};
	const extra: MetricDef[] = (appDefs ?? []).map((d: any) => {
		const source = `app:${d.app.slug}` as AppSourceId;
		appSources[source] = d.app.name;
		return { source, metric: d.metric, label: d.label, agg: d.agg, format: d.format ?? undefined };
	});
	const tiles = buildTiles(snapshots.data ?? [], 30, new Date(), extra);
	return {
		tiles,
		appSources,
		goals: kpiProgress(tiles, kpis.data ?? []),
		pipeline: pipelineStats(allLeads),
		reps: repStats(allLeads, actCounts, names),
		roi: {
			spend: totalSpend,
			since: spendFrom,
			costPerLead: totalSpend && windowLeads.length ? totalSpend / windowLeads.length : null,
			wonRevenue: windowWon,
			roi: totalSpend ? (windowWon - totalSpend) / totalSpend : null
		},
		huddle: huddle.data?.[0] ?? null
	};
}

export type Overview = Awaited<ReturnType<typeof loadOverview>>;
