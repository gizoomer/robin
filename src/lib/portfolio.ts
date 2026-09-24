import { buildTiles, pipelineStats, type LeadLite, type SnapshotRow, type Tile } from './dashboard';
import { METRICS, metricDef, type MetricDef } from './metrics';

export interface KpiSetting {
	source: string;
	metric: string;
	position: number;
	monthly_target: number | null;
}

export interface KpiProgress {
	def: MetricDef;
	value: number;
	target: number | null;
	/** value / target; for "lower is better" metrics, target / value */
	pct: number | null;
	delta: number | null;
	spark: Tile['spark'];
}

/** Joins a client's chosen KPIs with their last-30-day values. */
export function kpiProgress(tiles: Record<string, Tile[]>, kpis: KpiSetting[]): KpiProgress[] {
	return [...kpis]
		.sort((a, b) => a.position - b.position)
		.flatMap((k) => {
			const def = metricDef(k.source, k.metric);
			if (!def) return [];
			const t = tiles[k.source]?.find((x) => x.def.metric === k.metric);
			const value = t?.value ?? 0;
			const target = k.monthly_target == null ? null : Number(k.monthly_target);
			let pct: number | null = null;
			if (target && t) pct = def.upIsGood === false ? (value ? target / value : null) : value / target;
			return [{ def, value, target, pct, delta: t?.delta ?? null, spark: t?.spark ?? [] }];
		});
}

export interface ClientSummary {
	id: string;
	name: string;
	slug: string;
	industry: string | null;
	members: number;
	openPipeline: number;
	wonValue30: number;
	newLeads30: number;
	sessions: number | null;
	sessionsDelta: number | null;
	adSpend30: number;
	kpiAttainment: number | null;
	connected: number;
	alerts: string[];
}

export function summarizeClient(input: {
	org: { id: string; name: string; slug: string; industry?: string | null };
	members: number;
	leads: LeadLite[];
	snapshots: SnapshotRow[];
	kpis: KpiSetting[];
	integrations: { provider: string; status: string }[];
	today?: Date;
}): ClientSummary {
	const today = input.today ?? new Date();
	const tiles = buildTiles(input.snapshots, 30, today);
	const since30 = new Date(today.getTime() - 30 * 86400_000).toISOString();
	const sessions = tiles.ga4.find((t) => t.def.metric === 'sessions');
	const adSpend30 = [...tiles.google_ads, ...tiles.meta_ads].filter((t) => t.def.metric === 'spend').reduce((a, t) => a + t.value, 0);
	const progress = kpiProgress(tiles, input.kpis).filter((k) => k.pct != null);
	const kpiAttainment = progress.length ? progress.reduce((a, k) => a + Math.min(k.pct!, 1.5), 0) / progress.length : null;

	const alerts: string[] = [];
	const broken = input.integrations.filter((i) => i.status === 'error');
	if (broken.length) alerts.push(`${broken.map((b) => b.provider.replace('_', ' ')).join(', ')} needs reconnecting`);
	if (input.integrations.length === 0) alerts.push('No accounts connected');
	if (kpiAttainment != null && kpiAttainment < 0.8) alerts.push(`KPIs at ${Math.round(kpiAttainment * 100)}% of goal`);
	if (sessions?.delta != null && sessions.delta < -0.1) alerts.push(`Website visits down ${Math.round(-sessions.delta * 100)}%`);

	return {
		id: input.org.id,
		name: input.org.name,
		slug: input.org.slug,
		industry: input.org.industry ?? null,
		members: input.members,
		openPipeline: pipelineStats(input.leads).openValue,
		wonValue30: input.leads
			.filter((l) => l.stage === 'closed_won' && l.stage_changed_at >= since30)
			.reduce((a, l) => a + Number(l.estimated_value), 0),
		newLeads30: input.leads.filter((l) => l.created_at >= since30).length,
		sessions: sessions?.value ?? null,
		sessionsDelta: sessions?.delta ?? null,
		adSpend30,
		kpiAttainment,
		connected: input.integrations.filter((i) => i.status === 'connected').length,
		alerts
	};
}

/** Metrics the portfolio needs; keeps the cross-client query small. */
export const PORTFOLIO_METRICS = [...new Set(METRICS.map((m) => m.metric))];
