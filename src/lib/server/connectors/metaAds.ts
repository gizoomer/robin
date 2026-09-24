import { graph, metaOAuth } from './meta';
import { fetchJson, type AccountOption, type Connector, type MetricRow } from './types';

/** Meta Marketing API (Facebook + Instagram ads). `ads_read` needs App Review for Advanced Access. */
const SCOPES = ['ads_read', 'business_management'];

export interface MetaAdsConfig {
	adAccountId?: string; // "act_123"
	[k: string]: string | undefined;
}

interface InsightRow {
	date_start: string;
	spend?: string;
	impressions?: string;
	clicks?: string;
	actions?: { action_type: string; value: string }[];
}

export const metaAds: Connector<MetaAdsConfig, { adAccounts: AccountOption[] }> = {
	provider: 'meta_ads',
	...metaOAuth(SCOPES),

	async listAccounts(token) {
		const r = await fetchJson<{ data: { id: string; name: string }[] }>(
			'meta_ads',
			graph(`me/adaccounts?fields=id,name&limit=200&access_token=${token}`)
		);
		return { adAccounts: r.data.map((a) => ({ id: a.id, label: a.name })) };
	},

	async fetchMetrics(token, config, range) {
		const rows: MetricRow[] = [];
		if (!config.adAccountId) return { rows, warnings: [] };
		const p = new URLSearchParams({
			fields: 'spend,impressions,clicks,actions',
			time_range: JSON.stringify({ since: range.start, until: range.end }),
			time_increment: '1',
			level: 'account',
			limit: '500',
			access_token: token
		});
		let url: string | undefined = graph(`${config.adAccountId}/insights?${p}`);
		while (url) {
			const r: { data: InsightRow[]; paging?: { next?: string } } = await fetchJson('meta_ads', url);
			for (const d of r.data) {
				const day = d.date_start;
				const leads = (d.actions ?? []).filter((a) => a.action_type === 'lead').reduce((s, a) => s + Number(a.value), 0);
				rows.push({ source: 'meta_ads', metric: 'spend', day, value: Number(d.spend ?? 0) });
				rows.push({ source: 'meta_ads', metric: 'impressions', day, value: Number(d.impressions ?? 0) });
				rows.push({ source: 'meta_ads', metric: 'clicks', day, value: Number(d.clicks ?? 0) });
				rows.push({ source: 'meta_ads', metric: 'leads', day, value: leads });
			}
			url = r.paging?.next;
		}
		return { rows, warnings: [] };
	}
};
