import { error, fail } from '@sveltejs/kit';
import { connectors, isProvider } from '$lib/server/connectors';
import { getAccessToken, syncIntegration } from '$lib/server/integrations';
import { orgFromEvent } from '$lib/server/org';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';

const CONFIG_KEYS: Record<string, string[]> = {
	google: ['ga4PropertyId', 'gscSiteUrl', 'youtubeChannelId'],
	meta: ['pageId']
};

export async function load({ locals, parent }) {
	const { org, canManage } = await parent();
	if (!canManage) error(403, 'Only the account owner can manage connections');

	const [{ data: integrations }, { data: spend }] = await Promise.all([
		locals.supabase.from('integrations').select('*').eq('org_id', org.id),
		locals.supabase.from('marketing_spend').select('id, channel, month, amount').eq('org_id', org.id).order('month', { ascending: false }).limit(24)
	]);

	// Live account lists so the owner can pick which property/site/page to report on.
	const admin = supabaseAdmin();
	const options: Record<string, Record<string, { id: string; label: string }[]> | { error: string }> = {};
	await Promise.all(
		(integrations ?? []).map(async (i: { id: string; provider: string }) => {
			if (!isProvider(i.provider)) return;
			try {
				const token = await getAccessToken(admin, i.id, i.provider);
				options[i.provider] = await connectors[i.provider].listAccounts(token);
			} catch (e) {
				options[i.provider] = { error: (e as Error).message };
			}
		})
	);

	return { integrations: integrations ?? [], options, spend: spend ?? [] };
}

export const actions = {
	configure: async (event) => {
		const { org, canManage } = await orgFromEvent(event);
		if (!canManage) return fail(403, { error: 'Not allowed' });
		const f = await event.request.formData();
		const provider = String(f.get('provider'));
		if (!isProvider(provider)) return fail(400, { error: 'Unknown provider' });

		const config: Record<string, string> = {};
		for (const k of CONFIG_KEYS[provider]) {
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
