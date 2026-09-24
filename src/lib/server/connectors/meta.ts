import { env } from '$env/dynamic/private';
import { fetchJson, isoDay, type AccountOption, type Connector, type MetricRow } from './types';

/**
 * One Meta login covers the client's Facebook Page and the Instagram
 * Business/Creator account linked to it. Meta issues no refresh token:
 * we swap for a ~60 day long-lived token and flag the integration for
 * reconnect when it lapses.
 *
 * Meta renames and retires Insights metrics often. Each metric is requested
 * on its own so one retired metric produces a warning, not a failed sync.
 */
const SCOPES = [
	'pages_show_list',
	'pages_read_engagement',
	'read_insights',
	'instagram_basic',
	'instagram_manage_insights',
	'business_management'
];
const PAGE_DAILY_METRICS = ['page_post_engagements'];
const IG_DAILY_METRICS = ['reach'];

export interface MetaConfig {
	pageId?: string;
	pageName?: string;
	igUserId?: string;
	[k: string]: string | undefined;
}

export interface MetaAccounts {
	pages: (AccountOption & { igUserId?: string })[];
	[k: string]: AccountOption[];
}

export const graph = (path: string) => `https://graph.facebook.com/${env.META_GRAPH_VERSION || 'v23.0'}/${path}`;

interface InsightsResponse {
	data: { name: string; values: { value: number | Record<string, number>; end_time: string }[] }[];
}

/** Daily insight values are stamped with the *end* of the day; shift back one day. */
function insightDay(endTime: string) {
	const d = new Date(endTime);
	d.setUTCDate(d.getUTCDate() - 1);
	return isoDay(d);
}

/** Meta login pieces shared by the Page/Instagram and Ads connectors. */
export function metaOAuth(scopes: string[]) {
	return {
		authorizeUrl(state: string, redirectUri: string) {
			const p = new URLSearchParams({
				client_id: env.META_APP_ID ?? '',
				redirect_uri: redirectUri,
				state,
				scope: scopes.join(','),
				response_type: 'code'
			});
			return `https://www.facebook.com/${env.META_GRAPH_VERSION || 'v23.0'}/dialog/oauth?${p}`;
		},

		async exchangeCode(code: string, redirectUri: string) {
			const short = await fetchJson<{ access_token: string }>(
				'meta',
				graph(
					`oauth/access_token?${new URLSearchParams({
						client_id: env.META_APP_ID ?? '',
						client_secret: env.META_APP_SECRET ?? '',
						redirect_uri: redirectUri,
						code
					})}`
				)
			);
			const long = await fetchJson<{ access_token: string; expires_in?: number }>(
				'meta',
				graph(
					`oauth/access_token?${new URLSearchParams({
						grant_type: 'fb_exchange_token',
						client_id: env.META_APP_ID ?? '',
						client_secret: env.META_APP_SECRET ?? '',
						fb_exchange_token: short.access_token
					})}`
				)
			);
			return {
				accessToken: long.access_token,
				refreshToken: null,
				expiresAt: new Date(Date.now() + (long.expires_in ?? 60 * 24 * 3600) * 1000)
			};
		},

		async refresh() {
			return null;
		}
	};
}

export const meta: Connector<MetaConfig, MetaAccounts> = {
	provider: 'meta',
	...metaOAuth(SCOPES),

	async listAccounts(token) {
		const r = await fetchJson<{
			data: { id: string; name: string; instagram_business_account?: { id: string; username?: string } }[];
		}>('meta', graph(`me/accounts?fields=id,name,instagram_business_account{id,username}&limit=100&access_token=${token}`));
		return {
			pages: r.data.map((p) => ({
				id: p.id,
				label: p.instagram_business_account?.username ? `${p.name} + @${p.instagram_business_account.username}` : p.name,
				igUserId: p.instagram_business_account?.id
			}))
		};
	},

	async fetchMetrics(userToken, config, range) {
		const rows: MetricRow[] = [];
		const warnings: string[] = [];
		if (!config.pageId) return { rows, warnings };

		const today = isoDay(new Date());
		// Insights are queried with a page token; since/until are unix seconds and until is exclusive.
		const page = await fetchJson<{ access_token: string; followers_count?: number }>(
			'meta',
			graph(`${config.pageId}?fields=access_token,followers_count&access_token=${userToken}`)
		);
		const since = Math.floor(new Date(`${range.start}T00:00:00Z`).getTime() / 1000);
		const until = Math.floor(new Date(`${range.end}T00:00:00Z`).getTime() / 1000) + 86400;

		if (page.followers_count != null) {
			rows.push({ source: 'facebook', metric: 'followers', day: today, value: page.followers_count });
		}

		for (const metric of PAGE_DAILY_METRICS) {
			try {
				const r = await fetchJson<InsightsResponse>(
					'facebook',
					graph(`${config.pageId}/insights?metric=${metric}&period=day&since=${since}&until=${until}&access_token=${page.access_token}`)
				);
				for (const v of r.data[0]?.values ?? []) {
					if (typeof v.value === 'number') rows.push({ source: 'facebook', metric, day: insightDay(v.end_time), value: v.value });
				}
			} catch (e) {
				warnings.push(`Facebook ${metric}: ${(e as Error).message}`);
			}
		}

		if (config.igUserId) {
			try {
				const ig = await fetchJson<{ followers_count: number }>(
					'instagram',
					graph(`${config.igUserId}?fields=followers_count&access_token=${page.access_token}`)
				);
				rows.push({ source: 'instagram', metric: 'followers', day: today, value: ig.followers_count });
			} catch (e) {
				warnings.push(`Instagram followers: ${(e as Error).message}`);
			}
			// IG insights allow at most a 30 day window per call.
			const igSince = Math.max(since, until - 30 * 86400);
			for (const metric of IG_DAILY_METRICS) {
				try {
					const r = await fetchJson<InsightsResponse>(
						'instagram',
						graph(`${config.igUserId}/insights?metric=${metric}&period=day&since=${igSince}&until=${until}&access_token=${page.access_token}`)
					);
					for (const v of r.data[0]?.values ?? []) {
						if (typeof v.value === 'number') rows.push({ source: 'instagram', metric, day: insightDay(v.end_time), value: v.value });
					}
				} catch (e) {
					warnings.push(`Instagram ${metric}: ${(e as Error).message}`);
				}
			}
		}

		return { rows, warnings };
	}
};
