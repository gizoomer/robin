import { fail, redirect } from '@sveltejs/kit';
import { summarizeClient } from '$lib/portfolio';

export async function load({ locals }) {
	const { user } = await locals.safeGetSession();
	const [{ data: orgs }, { data: profile }] = await Promise.all([
		locals.supabase.from('organizations').select('id, name, slug, industry, status').order('name'),
		locals.supabase.from('profiles').select('is_agency_staff, full_name').eq('id', user!.id).single()
	]);
	const isAgency = !!profile?.is_agency_staff;
	if (!isAgency) {
		if (orgs?.length === 1) redirect(303, `/app/${orgs[0].slug}`);
		return { isAgency, orgs: orgs ?? [], clients: [], name: profile?.full_name ?? '' };
	}

	// Agency portfolio: one pass over every client's data.
	const since = new Date(Date.now() - 62 * 86400_000).toISOString().slice(0, 10);
	const [leads, snaps, kpis, integrations, members] = await Promise.all([
		locals.supabase.from('leads').select('org_id, owner_id, stage, estimated_value, created_at, stage_changed_at'),
		locals.supabase
			.from('metric_snapshots')
			.select('org_id, source, metric, day, value')
			.gte('day', since)
			.in('metric', ['sessions', 'keyEvents', 'clicks', 'reach', 'spend', 'conversions', 'leads', 'position']),
		locals.supabase.from('org_kpis').select('org_id, source, metric, position, monthly_target'),
		locals.supabase.from('integrations').select('org_id, provider, status'),
		locals.supabase.from('org_members').select('org_id')
	]);

	const by = <T extends { org_id: string }>(rows: T[] | null, id: string) => (rows ?? []).filter((r) => r.org_id === id);
	const clients = (orgs ?? [])
		.filter((o) => o.status !== 'archived')
		.map((o) =>
			summarizeClient({
				org: o,
				members: by(members.data, o.id).length,
				leads: by(leads.data, o.id),
				snapshots: by(snaps.data, o.id),
				kpis: by(kpis.data, o.id),
				integrations: by(integrations.data, o.id)
			})
		);

	return { isAgency, orgs: orgs ?? [], clients, name: profile?.full_name ?? '' };
}

export const actions = {
	createOrg: async ({ request, locals }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const industry = String(form.get('industry') ?? '').trim() || null;
		const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
		if (slug.length < 2) return fail(400, { error: 'Name is too short' });
		if (slug === 'partners') return fail(400, { error: 'That name is reserved. Add a word, e.g. "Partners Group".' });
		const { error } = await locals.supabase.from('organizations').insert({ name, slug, industry });
		if (error) return fail(400, { error: error.code === '23505' ? 'That client already exists' : error.message });
		// New client: go straight to inviting their team.
		redirect(303, `/app/${slug}/team?new=1`);
	}
};
