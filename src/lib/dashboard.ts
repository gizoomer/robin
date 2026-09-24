import { METRICS, SOURCES, type MetricDef, type SourceId } from './metrics';

export interface SnapshotRow {
	source: string;
	metric: string;
	day: string;
	value: number;
}

export interface Tile {
	def: MetricDef;
	value: number;
	prior: number | null;
	/** fractional change vs prior period, null when there is no prior data */
	delta: number | null;
	spark: { day: string; value: number }[];
}

function aggregate(values: number[], agg: MetricDef['agg']) {
	if (values.length === 0) return null;
	if (agg === 'last') return values[values.length - 1];
	const sum = values.reduce((a, b) => a + b, 0);
	return agg === 'avg' ? sum / values.length : sum;
}

/**
 * Turns raw daily snapshots into dashboard tiles: current window vs the
 * equally long window before it. `today` is injectable for testing.
 */
/** `extra` adds metric definitions beyond the built-in catalog (partner apps register their own). */
export function buildTiles(rows: SnapshotRow[], days = 30, today = new Date(), extra: MetricDef[] = []): Record<string, Tile[]> {
	const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
	const cut = new Date(end);
	cut.setUTCDate(cut.getUTCDate() - days);
	const priorCut = new Date(cut);
	priorCut.setUTCDate(priorCut.getUTCDate() - days);
	const cutIso = cut.toISOString().slice(0, 10);
	const priorIso = priorCut.toISOString().slice(0, 10);

	const out: Record<string, Tile[]> = Object.fromEntries(Object.keys(SOURCES).map((s) => [s, [] as Tile[]]));

	for (const def of [...METRICS, ...extra]) {
		const series = rows
			.filter((r) => r.source === def.source && r.metric === def.metric)
			.sort((a, b) => a.day.localeCompare(b.day));
		const cur = series.filter((r) => r.day >= cutIso);
		if (cur.length === 0) continue;
		const prev = series.filter((r) => r.day >= priorIso && r.day < cutIso);

		const value = aggregate(cur.map((r) => Number(r.value)), def.agg)!;
		const prior = aggregate(prev.map((r) => Number(r.value)), def.agg);
		const delta = prior == null || prior === 0 ? null : (value - prior) / Math.abs(prior);
		(out[def.source] ??= []).push({ def, value, prior, delta, spark: cur.map((r) => ({ day: r.day, value: Number(r.value) })) });
	}
	return out;
}

export interface LeadLite {
	owner_id: string | null;
	stage: string;
	estimated_value: number;
	created_at: string;
	stage_changed_at: string;
}

export function pipelineStats(leads: LeadLite[]) {
	const open = leads.filter((l) => !l.stage.startsWith('closed'));
	const won = leads.filter((l) => l.stage === 'closed_won');
	const lost = leads.filter((l) => l.stage === 'closed_lost');
	const closed = won.length + lost.length;
	return {
		openValue: open.reduce((a, l) => a + Number(l.estimated_value), 0),
		openCount: open.length,
		wonValue: won.reduce((a, l) => a + Number(l.estimated_value), 0),
		wonCount: won.length,
		winRate: closed ? won.length / closed : null
	};
}

export function repStats(leads: LeadLite[], activityCounts: Map<string, number>, names: Map<string, string>) {
	const reps = new Set([...leads.map((l) => l.owner_id).filter(Boolean), ...activityCounts.keys()] as string[]);
	return [...reps]
		.map((id) => {
			const mine = leads.filter((l) => l.owner_id === id);
			const s = pipelineStats(mine);
			return { id, name: names.get(id) ?? 'Unknown', leads: mine.length, ...s, activities: activityCounts.get(id) ?? 0 };
		})
		.sort((a, b) => b.wonValue - a.wonValue || b.activities - a.activities);
}
