import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { connectors, type ProviderId } from './connectors';
import { isoDay, type TokenSet } from './connectors/types';
import { decrypt, encrypt } from './crypto';
import { isDemo } from './demo';

export async function saveTokens(admin: SupabaseClient, integrationId: string, t: TokenSet) {
	const { error } = await admin.from('integration_secrets').upsert({
		integration_id: integrationId,
		access_token_enc: encrypt(t.accessToken, env.TOKEN_ENCRYPTION_KEY),
		refresh_token_enc: t.refreshToken ? encrypt(t.refreshToken, env.TOKEN_ENCRYPTION_KEY) : null,
		expires_at: t.expiresAt?.toISOString() ?? null,
		updated_at: new Date().toISOString()
	});
	if (error) throw error;
}

/** Returns a usable access token, refreshing it first if it is about to expire. */
export async function getAccessToken(admin: SupabaseClient, integrationId: string, provider: ProviderId) {
	const { data, error } = await admin
		.from('integration_secrets')
		.select('*')
		.eq('integration_id', integrationId)
		.single();
	if (error || !data) throw new Error('No stored credentials. Reconnect this account.');

	const tokens: TokenSet = {
		accessToken: decrypt(data.access_token_enc, env.TOKEN_ENCRYPTION_KEY),
		refreshToken: data.refresh_token_enc ? decrypt(data.refresh_token_enc, env.TOKEN_ENCRYPTION_KEY) : null,
		expiresAt: data.expires_at ? new Date(data.expires_at) : null
	};
	if (!tokens.expiresAt || tokens.expiresAt.getTime() > Date.now() + 60_000) return tokens.accessToken;

	const fresh = await connectors[provider].refresh(tokens);
	if (!fresh) throw new Error('Access expired. Reconnect this account.');
	await saveTokens(admin, integrationId, fresh);
	return fresh.accessToken;
}

interface IntegrationRow {
	id: string;
	org_id: string;
	provider: ProviderId;
	config: Record<string, string>;
	last_synced_at: string | null;
}

/**
 * Pull daily metrics for one integration and upsert them into metric_snapshots.
 * First sync backfills 90 days; later syncs re-pull 7 days because GA4/GSC revise recent data.
 */
export async function syncIntegration(admin: SupabaseClient, integ: IntegrationRow) {
	const end = new Date();
	end.setUTCDate(end.getUTCDate() - 1);
	const start = new Date(end);
	start.setUTCDate(start.getUTCDate() - (integ.last_synced_at ? 7 : 90));

	if (isDemo()) {
		await admin.from('integrations').update({ status: 'connected', last_synced_at: new Date().toISOString() }).eq('id', integ.id);
		return { rows: 0, warnings: ['Demo mode: sample data only, nothing was fetched.'] };
	}

	try {
		const token = await getAccessToken(admin, integ.id, integ.provider);
		const { rows, warnings } = await connectors[integ.provider].fetchMetrics(token, integ.config, {
			start: isoDay(start),
			end: isoDay(end)
		});

		for (let i = 0; i < rows.length; i += 500) {
			const { error } = await admin.from('metric_snapshots').upsert(
				rows.slice(i, i + 500).map((r) => ({ ...r, org_id: integ.org_id, updated_at: new Date().toISOString() }))
			);
			if (error) throw error;
		}

		await admin
			.from('integrations')
			.update({
				status: 'connected',
				last_synced_at: new Date().toISOString(),
				last_error: warnings.length ? warnings.join(' | ').slice(0, 1000) : null
			})
			.eq('id', integ.id);
		return { rows: rows.length, warnings };
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		await admin.from('integrations').update({ status: 'error', last_error: message.slice(0, 1000) }).eq('id', integ.id);
		return { rows: 0, warnings: [message] };
	}
}
