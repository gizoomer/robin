import { error, fail } from '@sveltejs/kit';
import { providerInfo } from '$lib/providers';
import { connectors, isProvider } from '$lib/server/connectors';
import { getAccessToken, saveTokens, syncIntegration } from '$lib/server/integrations';
import { orgFromEvent } from '$lib/server/org';
import { demoAccountOptions, isDemo } from '$lib/server/demo';
import { configuredProviders } from '$lib/server/ai';
import { generateKey } from '$lib/server/partner';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';


export async function load({ locals, parent }) {
	const { org, canManage } = await parent();
	if (!canManage) error(403, 'Only the account owner can manage connections');

	const [{ data: integrations }, { data: spend }, { data: apps }, { data: keys }] = await Promise.all([
		locals.supabase.from('integrations').select('*').eq('org_id', org.id),
		locals.supabase.from('marketing_spend').select('id, channel, month, amount').eq('org_id', org.id).order('month', { ascending: false }).limit(24),
		locals.supabase.from('partner_apps').select('id, name, description, website').eq('status', 'active').order('name'),
		locals.supabase.from('partner_keys').select('id, app_id, key_prefix, created_at, last_used_at').eq('org_id', org.id).is('revoked_at', null)
	]);
	const { data: orgSettings } = await locals.supabase.from('organizations').select('ai_enabled').eq('id', org.id).single();

	// Live account lists so the owner can pick which property/site/page to report on.
	const admin = supabaseAdmin();
	const options: Record<string, Record<string, { id: string; label: string }[]> | { error: string }> = {};
	await Promise.all(
		(integrations ?? []).map(async (i: { id: string; provider: string }) => {
			if (!isProvider(i.provider)) return;
			if (isDemo()) return void (options[i.provider] = demoAccountOptions(i.provider, org.name));
			try {
				const token = await getAccessToken(admin, i.id, i.provider);
				options[i.provider] = await connectors[i.provider].listAccounts(token);
			} catch (e) {
				options[i.provider] = { error: (e as Error).message };
			}
		})
	);

	// Field definitions for API-key platforms (labels only; never values).
	const credentialFields = Object.fromEntries(
		Object.entries(connectors).flatMap(([id, c]) => (c.auth === 'apikey' && c.credentialFields ? [[id, c.credentialFields]] : []))
	);
	return { integrations: integrations ?? [], options, spend: spend ?? [], credentialFields, partnerApps: apps ?? [], partnerKeys: keys ?? [], aiEnabled: orgSettings?.ai_enabled !== false, aiProviders: isDemo() ? ['claude', 'chatgpt'] : configuredProviders() };
}

export const actions = {
	/** API-key platforms (WhatConverts): check the pasted credentials, then store them encrypted. */
	credentials: async (event) => {
		const { org, canManage, userId } = await orgFromEvent(event);
		if (!canManage) return fail(403, { error: 'Not allowed' });
		const f = await event.request.formData();
		const provider = String(f.get('provider'));
		if (!isProvider(provider)) return fail(400, { error: 'Unknown provider' });
		const connector = connectors[provider];
		if (connector.auth !== 'apikey' || !connector.credentialFields) return fail(400, { error: 'This platform connects with sign-in' });

		const creds: Record<string, string> = {};
		for (const field of connector.credentialFields) {
			const v = String(f.get(field.key) ?? '').trim();
			if (!v) return fail(400, { error: `Enter the ${field.label}` });
			creds[field.key] = v;
		}
		if (!isDemo()) {
			try {
				await connector.verify?.(creds);
			} catch (e) {
				return fail(400, { error: `${providerInfo(provider)?.name ?? provider} rejected those credentials: ${(e as Error).message}` });
			}
		}

		// The integration row goes through RLS (only admins/agency may write it); the secret goes through the service role.
		const { data: integ, error: err } = await event.locals.supabase
			.from('integrations')
			.upsert({ org_id: org.id, provider, status: 'pending_setup', connected_by: userId, last_error: null }, { onConflict: 'org_id,provider' })
			.select('id')
			.single();
		if (err || !integ) return fail(403, { error: 'You do not have permission to connect accounts for this client' });
		if (!isDemo()) await saveTokens(supabaseAdmin(), integ.id, { accessToken: JSON.stringify(creds), refreshToken: null, expiresAt: null });
		return { connected: provider };
	},

	/** Turns the AI report assistant on or off for this client. */
	ai: async (event) => {
		const { org, canManage } = await orgFromEvent(event);
		if (!canManage) return fail(403, { error: 'Not allowed' });
		const enabled = (await event.request.formData()).get('enabled') === 'true';
		await event.locals.supabase.from('organizations').update({ ai_enabled: enabled }).eq('id', org.id);
		return { aiSaved: enabled };
	},

	/** Issues a partner app a key for this client only. The full key is returned once and never stored. */
	createKey: async (event) => {
		const { org, canManage, userId } = await orgFromEvent(event);
		if (!canManage) return fail(403, { error: 'Not allowed' });
		const appId = String((await event.request.formData()).get('app'));
		const { key, prefix, hash } = generateKey();
		const { error: err } = await event.locals.supabase
			.from('partner_keys')
			.insert({ app_id: appId, org_id: org.id, key_prefix: prefix, key_hash: hash, created_by: userId });
		if (err) return fail(400, { error: err.message });
		return { newKey: key, newKeyApp: appId };
	},

	revokeKey: async (event) => {
		const { org, canManage } = await orgFromEvent(event);
		if (!canManage) return fail(403, { error: 'Not allowed' });
		const id = String((await event.request.formData()).get('key'));
		await event.locals.supabase.from('partner_keys').update({ revoked_at: new Date().toISOString() }).eq('id', id).eq('org_id', org.id);
		return { revoked: true };
	},

	configure: async (event) => {
		const { org, canManage } = await orgFromEvent(event);
		if (!canManage) return fail(403, { error: 'Not allowed' });
		const f = await event.request.formData();
		const provider = String(f.get('provider'));
		if (!isProvider(provider)) return fail(400, { error: 'Unknown provider' });

		const config: Record<string, string> = {};
		for (const k of providerInfo(provider)?.pickers.map((p) => p.field) ?? []) {
			const v = String(f.get(k) ?? '');
			if (v) config[k] = v;
		}
		if (provider === 'meta' && config.pageId) {
			// Resolve the linked Instagram account and page name from the live list.
			const ig = String(f.get(`ig:${config.pageId}`) ?? '');
			if (ig) config.igUserId = ig;
			config.pageName = String(f.get(`name:${config.pageId}`) ?? '');
		}

		const { data: integ, error: err } = await event.locals.supabase
			.from('integrations')
			.update({ config, status: 'connected', account_label: provider === 'meta' ? config.pageName : null })
			.eq('org_id', org.id)
			.eq('provider', provider)
			.select('id, org_id, provider, config, last_synced_at')
			.single();
		if (err || !integ) return fail(400, { error: err?.message ?? 'Not found' });

		const result = await syncIntegration(supabaseAdmin(), integ);
		return { synced: result.rows, warnings: result.warnings };
	},

	sync: async (event) => {
		const { org, canManage } = await orgFromEvent(event);
		if (!canManage) return fail(403, { error: 'Not allowed' });
		const provider = String((await event.request.formData()).get('provider'));
		const { data: integ } = await event.locals.supabase
			.from('integrations')
			.select('id, org_id, provider, config, last_synced_at')
			.eq('org_id', org.id)
			.eq('provider', provider)
			.single();
		if (!integ) return fail(404, { error: 'Not connected' });
		const result = await syncIntegration(supabaseAdmin(), integ);
		return { synced: result.rows, warnings: result.warnings };
	},

	disconnect: async (event) => {
		const { org, canManage } = await orgFromEvent(event);
		if (!canManage) return fail(403, { error: 'Not allowed' });
		const provider = String((await event.request.formData()).get('provider'));
		// Cascades to integration_secrets. Historical metrics are kept.
		await event.locals.supabase.from('integrations').delete().eq('org_id', org.id).eq('provider', provider);
		return { disconnected: provider };
	},

	spend: async (event) => {
		const { org, canManage } = await orgFromEvent(event);
		if (!canManage) return fail(403, { error: 'Not allowed' });
		const f = await event.request.formData();
		const channel = String(f.get('channel') ?? '').trim();
		const month = String(f.get('month') ?? ''); // YYYY-MM from <input type="month">
		const amount = Number(String(f.get('amount') ?? '').replace(/[$,]/g, ''));
		if (!channel || !/^\d{4}-\d{2}$/.test(month) || !Number.isFinite(amount) || amount < 0) {
			return fail(400, { spendError: 'Enter a channel, month and amount' });
		}
		const { error: err } = await event.locals.supabase
			.from('marketing_spend')
			.upsert({ org_id: org.id, channel, month: `${month}-01`, amount }, { onConflict: 'org_id,channel,month' });
		if (err) return fail(400, { spendError: err.message });
		return { spendSaved: true };
	}
};
