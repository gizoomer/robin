import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { syncIntegration } from '$lib/server/integrations';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';

/** Nightly job (see vercel.json). Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET({ request }) {
	if (!env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) {
		error(401, 'Unauthorized');
	}
	const admin = supabaseAdmin();
	const { data: integrations, error: err } = await admin
		.from('integrations')
		.select('id, org_id, provider, config, last_synced_at')
		.in('status', ['connected', 'error']);
	if (err) error(500, err.message);

	const results = [];
	for (const integ of integrations ?? []) {
		results.push({ id: integ.id, ...(await syncIntegration(admin, integ)) });
	}
	return json({ synced: results.length, results });
}
