import { error } from '@sveltejs/kit';
import { hashMatches, parseBearer } from '$lib/server/partner';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';

/** Resolves a partner request to its key, app and client account, or throws 401. */
export async function authenticatePartner(request: Request) {
	const parsed = parseBearer(request.headers.get('authorization'));
	if (!parsed) error(401, 'Send your MYCMO partner key as: Authorization: Bearer mycmo_pk_...');
	const admin = supabaseAdmin();
	const { data: key } = await admin
		.from('partner_keys')
		.select('id, key_hash, org_id, revoked_at, app:partner_apps(id, slug, name, status)')
		.eq('key_prefix', parsed.prefix)
		.maybeSingle();
	const app = key?.app as unknown as { id: string; slug: string; name: string; status: string } | null;
	if (!key || key.revoked_at || !hashMatches(parsed.key, key.key_hash) || !app || app.status !== 'active') {
		error(401, 'Invalid or revoked partner key');
	}
	const { data: metrics } = await admin.from('partner_app_metrics').select('metric, label, agg, format').eq('app_id', app.id);
	return { admin, keyId: key.id as string, orgId: key.org_id as string, app, metrics: metrics ?? [] };
}
