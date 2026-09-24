import { env } from '$env/dynamic/private';
import { googleOAuth } from './google';
import { fetchJson, type AccountOption, type Connector, type MetricRow } from './types';

/**
 * Google Ads API. Needs, beyond the shared Google OAuth client:
 *   GOOGLE_ADS_DEVELOPER_TOKEN      from your Google Ads manager (MCC) account > API Center.
 *                                   Test tokens only see test accounts; production data
 *                                   needs Basic Access approval from Google.
 *   GOOGLE_ADS_LOGIN_CUSTOMER_ID    your MCC id (digits only) when clients' accounts sit under it.
 *   GOOGLE_ADS_API_VERSION          defaults to v21; Google sunsets versions about yearly.
 */
const SCOPES = ['https://www.googleapis.com/auth/adwords'];

export interface GoogleAdsConfig {
	customerId?: string;
	[k: string]: string | undefined;
}

const api = (path: string) => `https://googleads.googleapis.com/${env.GOOGLE_ADS_API_VERSION || 'v21'}/${path}`;

function headers(token: string) {
	const h: Record<string, string> = {
		Authorization: `Bearer ${token}`,
		'developer-token': env.GOOGLE_ADS_DEVELOPER_TOKEN ?? '',
		'Content-Type': 'application/json'
	};
	if (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) h['login-customer-id'] = env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/\D/g, '');
	return h;
}

export const googleAds: Connector<GoogleAdsConfig, { customers: AccountOption[] }> = {
	provider: 'google_ads',
	...googleOAuth(SCOPES),

	async listAccounts(token) {
		const r = await fetchJson<{ resourceNames?: string[] }>('google_ads', api('customers:listAccessibleCustomers'), {
			headers: headers(token)
		});
		return {
			customers: (r.resourceNames ?? []).map((n) => {
				const id = n.split('/')[1];
				return { id, label: `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}` };
			})
		};
	},

	async fetchMetrics(token, config, range) {
		const rows: MetricRow[] = [];
		if (!config.customerId) return { rows, warnings: [] };
		const query = `SELECT segments.date, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions
			FROM customer WHERE segments.date BETWEEN '${range.start}' AND '${range.end}'`;
		const chunks = await fetchJson<
			{ results?: { segments: { date: string }; metrics: { costMicros?: string; clicks?: string; impressions?: string; conversions?: number } }[] }[]
		>('google_ads', api(`customers/${config.customerId}/googleAds:searchStream`), {
			method: 'POST',
			headers: headers(token),
			body: JSON.stringify({ query })
		});
		for (const r of chunks.flatMap((c) => c.results ?? [])) {
			const day = r.segments.date;
			rows.push({ source: 'google_ads', metric: 'spend', day, value: Number(r.metrics.costMicros ?? 0) / 1e6 });
			rows.push({ source: 'google_ads', metric: 'clicks', day, value: Number(r.metrics.clicks ?? 0) });
			rows.push({ source: 'google_ads', metric: 'impressions', day, value: Number(r.metrics.impressions ?? 0) });
			rows.push({ source: 'google_ads', metric: 'conversions', day, value: Number(r.metrics.conversions ?? 0) });
		}
		return { rows, warnings: [] };
	}
};
