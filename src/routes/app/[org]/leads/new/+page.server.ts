import { error, fail, redirect } from '@sveltejs/kit';
import { orgFromEvent } from '$lib/server/org';
import { LEAD_SOURCES } from '$lib/metrics';

export async function load({ parent }) {
	const { canWork } = await parent();
	if (!canWork) error(403, 'View-only accounts cannot add leads');
}

export const actions = {
	default: async (event) => {
		const { request, locals } = event;
		const { org, userId } = await orgFromEvent(event);
		const f = await request.formData();
		const values = {
			name: String(f.get('name') ?? '').trim(),
			phone: String(f.get('phone') ?? '').trim(),
			company: String(f.get('company') ?? '').trim(),
			address: String(f.get('address') ?? '').trim(),
			source: String(f.get('source') ?? 'other'),
			estimated_value: String(f.get('estimated_value') ?? '0')
		};
		if (!values.name) return fail(400, { values, error: 'Name is required' });
		if (!LEAD_SOURCES.some((s) => s.id === values.source)) return fail(400, { values, error: 'Pick a lead source' });
		const amount = Number(values.estimated_value.replace(/[$,]/g, '') || 0);
		if (!Number.isFinite(amount) || amount < 0) return fail(400, { values, error: 'Deal value must be a positive number' });

		const { error: err } = await locals.supabase.from('leads').insert({
			org_id: org.id,
			owner_id: userId,
			name: values.name,
			phone: values.phone || null,
			company: values.company || null,
			address: values.address || null,
			source: values.source,
			estimated_value: amount
		});
		if (err) return fail(400, { values, error: err.message });

		if (f.get('again')) return { saved: values.name };
		redirect(303, `/app/${org.slug}/pipeline`);
	}
};
