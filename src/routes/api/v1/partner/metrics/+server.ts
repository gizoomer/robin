import { error, json } from '@sveltejs/kit';
import { validatePayload } from '$lib/server/partner';
import { authenticatePartner } from '../auth';

/**
 * POST /api/v1/partner/metrics
 * Authorization: Bearer mycmo_pk_...
 * { "metrics": [ { "metric": "calls", "date": "2026-09-23", "value": 12 } ] }
 *
 * Re-sending the same metric and date overwrites it, so partners can safely resend.
 */
export async function POST({ request }) {
	const { admin, keyId, orgId, app, metrics } = await authenticatePartner(request);
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		error(400, 'Body must be valid JSON');
	}
	const { rows, rejected, error: bad } = validatePayload(body, new Set(metrics.map((m) => m.metric)));
	if (bad) error(400, bad);

	if (rows.length) {
		const now = new Date().toISOString();
		const { error: err } = await admin
			.from('metric_snapshots')
			.upsert(rows.map((r) => ({ org_id: orgId, source: `app:${app.slug}`, metric: r.metric, day: r.day, value: r.value, updated_at: now })));
		if (err) error(500, 'Could not save metrics. Please retry.');
	}
	await admin.from('partner_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyId);
	return json({ accepted: rows.length, rejected });
}
