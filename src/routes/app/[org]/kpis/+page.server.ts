import { error, fail } from '@sveltejs/kit';
import { METRICS, metricDef } from '$lib/metrics';
import { orgFromEvent } from '$lib/server/org';

const MAX_KPIS = 6;

export async function load({ locals, parent }) {
	const { org, canManage } = await parent();
	if (!canManage) error(403, 'Only the account owner can change KPIs');
	const [{ data: kpis }, { data: integrations }] = await Promise.all([
		locals.supabase.from('org_kpis').select('source, metric, position, monthly_target').eq('org_id', org.id),
		locals.supabase.from('integrations').select('provider').eq('org_id', org.id)
	]);
	return { kpis: kpis ?? [], connected: (integrations ?? []).map((i) => i.provider), max: MAX_KPIS };
}

export const actions = {
	default: async (event) => {
		const { org, canManage } = await orgFromEvent(event);
		if (!canManage) return fail(403, { error: 'Not allowed' });
		const f = await event.request.formData();
		const chosen = f.getAll('kpi').map(String);
		if (chosen.length > MAX_KPIS) return fail(400, { error: `Pick at most ${MAX_KPIS} headline KPIs` });

		const rows = [];
		for (const key of chosen) {
			const [source, metric] = key.split(':');
			if (!metricDef(source, metric)) return fail(400, { error: 'Unknown metric' });
			const raw = String(f.get(`target:${key}`) ?? '').replace(/[$,]/g, '').trim();
			const target = raw === '' ? null : Number(raw);
			if (target != null && (!Number.isFinite(target) || target < 0)) return fail(400, { error: 'Goals must be positive numbers' });
			rows.push({ org_id: org.id, source, metric, position: METRICS.findIndex((m) => m.source === source && m.metric === metric), monthly_target: target });
		}

		const db = event.locals.supabase;
		await db.from('org_kpis').delete().eq('org_id', org.id);
		if (rows.length) {
			const { error: err } = await db.from('org_kpis').insert(rows);
			if (err) return fail(400, { error: err.message });
		}
		return { saved: rows.length };
	}
};
