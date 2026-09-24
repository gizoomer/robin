import { error, fail } from '@sveltejs/kit';
import { parseMetricLines } from '$lib/server/partner';

async function requireAgency(locals: App.Locals) {
	const { user } = await locals.safeGetSession();
	const { data } = await locals.supabase.from('profiles').select('is_agency_staff').eq('id', user!.id).single();
	if (!data?.is_agency_staff) error(403, 'Only agency staff manage partner apps');
	return user!;
}

export async function load({ locals }) {
	await requireAgency(locals);
	const [{ data: apps }, { data: metrics }, { data: keys }] = await Promise.all([
		locals.supabase.from('partner_apps').select('*').order('name'),
		locals.supabase.from('partner_app_metrics').select('*'),
		locals.supabase.from('partner_keys').select('app_id, revoked_at')
	]);
	return {
		apps: (apps ?? []).map((a: { id: string; name: string; slug: string; status: string; description: string | null }) => ({
			...a,
			metrics: ((metrics ?? []) as { app_id: string; metric: string; label: string }[]).filter((m) => m.app_id === a.id),
			activeKeys: (keys ?? []).filter((k) => k.app_id === a.id && !k.revoked_at).length
		}))
	};
}

export const actions = {
	create: async ({ request, locals }) => {
		const user = await requireAgency(locals);
		const f = await request.formData();
		const name = String(f.get('name') ?? '').trim();
		const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
		if (slug.length < 2) return fail(400, { error: 'Enter the partner name' });
		let metrics;
		try {
			metrics = parseMetricLines(String(f.get('metrics') ?? ''));
		} catch (e) {
			return fail(400, { error: (e as Error).message });
		}
		if (!metrics.length) return fail(400, { error: 'List at least one metric the partner will send' });

		const { data: app, error: err } = await locals.supabase
			.from('partner_apps')
			.insert({ name, slug, website: String(f.get('website') ?? '') || null, contact_email: String(f.get('email') ?? '') || null, description: String(f.get('description') ?? '') || null, created_by: user.id })
			.select('id')
			.single();
		if (err || !app) return fail(400, { error: err?.code === '23505' ? 'A partner with that name already exists' : (err?.message ?? 'Could not save') });
		await locals.supabase.from('partner_app_metrics').insert(metrics.map((m) => ({ ...m, app_id: app.id })));
		return { created: name };
	},

	toggle: async ({ request, locals }) => {
		await requireAgency(locals);
		const f = await request.formData();
		await locals.supabase.from('partner_apps').update({ status: f.get('status') === 'active' ? 'disabled' : 'active' }).eq('id', String(f.get('id')));
		return { ok: true };
	}
};
