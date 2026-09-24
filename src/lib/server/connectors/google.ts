import { env } from '$env/dynamic/private';
import { fetchJson, type AccountOption, type Connector, type MetricRow, type TokenSet } from './types';

/**
 * One Google OAuth grant covers GA4, Search Console and YouTube.
 * All four scopes are read-only. They are "sensitive" scopes, so a public
 * launch needs Google's OAuth app verification (see README).
 */
const SCOPES = [
	'https://www.googleapis.com/auth/analytics.readonly',
	'https://www.googleapis.com/auth/webmasters.readonly',
	'https://www.googleapis.com/auth/youtube.readonly',
	'https://www.googleapis.com/auth/yt-analytics.readonly'
];

export interface GoogleConfig {
	ga4PropertyId?: string; // "properties/123456"
	gscSiteUrl?: string; // "sc-domain:example.com" or "https://example.com/"
	youtubeChannelId?: string;
	[k: string]: string | undefined;
}

export interface GoogleAccounts {
	ga4: AccountOption[];
	gsc: AccountOption[];
	youtube: AccountOption[];
	[k: string]: AccountOption[];
}

interface GoogleTokenResponse {
	access_token: string;
	refresh_token?: string;
	expires_in: number;
}

function toTokens(t: GoogleTokenResponse, prevRefresh?: string | null): TokenSet {
	return {
		accessToken: t.access_token,
		refreshToken: t.refresh_token ?? prevRefresh ?? null,
		expiresAt: new Date(Date.now() + (t.expires_in - 60) * 1000)
	};
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export const google: Connector<GoogleConfig, GoogleAccounts> = {
	provider: 'google',

	authorizeUrl(state, redirectUri) {
		const p = new URLSearchParams({
			client_id: env.GOOGLE_CLIENT_ID ?? '',
			redirect_uri: redirectUri,
			response_type: 'code',
			scope: SCOPES.join(' '),
			access_type: 'offline',
			prompt: 'consent', // guarantees a refresh_token on reconnect
			include_granted_scopes: 'true',
			state
		});
		return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
	},

	async exchangeCode(code, redirectUri) {
		const t = await fetchJson<GoogleTokenResponse>('google', 'https://oauth2.googleapis.com/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				code,
				client_id: env.GOOGLE_CLIENT_ID ?? '',
				client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
				redirect_uri: redirectUri,
				grant_type: 'authorization_code'
			})
		});
		return toTokens(t);
	},

	async refresh(tokens) {
		if (!tokens.refreshToken) return null;
		const t = await fetchJson<GoogleTokenResponse>('google', 'https://oauth2.googleapis.com/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				client_id: env.GOOGLE_CLIENT_ID ?? '',
				client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
				refresh_token: tokens.refreshToken,
				grant_type: 'refresh_token'
			})
		});
		return toTokens(t, tokens.refreshToken);
	},

	async listAccounts(token) {
		const [ga4, gsc, youtube] = await Promise.all([
			fetchJson<{ accountSummaries?: { displayName: string; propertySummaries?: { property: string; displayName: string }[] }[] }>(
				'google',
				'https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200',
				{ headers: bearer(token) }
			)
				.then((r) =>
					(r.accountSummaries ?? []).flatMap((a) =>
						(a.propertySummaries ?? []).map((p) => ({ id: p.property, label: `${p.displayName} (${a.displayName})` }))
					)
				)
				.catch(() => []),
			fetchJson<{ siteEntry?: { siteUrl: string; permissionLevel: string }[] }>(
				'google',
				'https://www.googleapis.com/webmasters/v3/sites',
				{ headers: bearer(token) }
			)
				.then((r) =>
					(r.siteEntry ?? [])
						.filter((s) => s.permissionLevel !== 'siteUnverifiedUser')
						.map((s) => ({ id: s.siteUrl, label: s.siteUrl }))
				)
				.catch(() => []),
			fetchJson<{ items?: { id: string; snippet: { title: string } }[] }>(
				'google',
				'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
				{ headers: bearer(token) }
			)
				.then((r) => (r.items ?? []).map((c) => ({ id: c.id, label: c.snippet.title })))
				.catch(() => [])
		]);
		return { ga4, gsc, youtube };
	},

	async fetchMetrics(token, config, range) {
		const rows: MetricRow[] = [];
		const warnings: string[] = [];
		const jobs: Promise<void>[] = [];

		if (config.ga4PropertyId) {
			jobs.push(
				(async () => {
					const metrics = ['sessions', 'totalUsers', 'keyEvents'];
					const r = await fetchJson<{
						rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[];
					}>('ga4', `https://analyticsdata.googleapis.com/v1beta/${config.ga4PropertyId}:runReport`, {
						method: 'POST',
						headers: { ...bearer(token), 'Content-Type': 'application/json' },
						body: JSON.stringify({
							dateRanges: [{ startDate: range.start, endDate: range.end }],
							dimensions: [{ name: 'date' }],
							metrics: metrics.map((name) => ({ name })),
							limit: 1000
						})
					});
					for (const row of r.rows ?? []) {
						const d = row.dimensionValues[0].value; // YYYYMMDD
						const day = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
						metrics.forEach((metric, i) =>
							rows.push({ source: 'ga4', metric, day, value: Number(row.metricValues[i].value) })
						);
					}
				})().catch((e) => void warnings.push(`GA4: ${e.message}`))
			);
		}

		if (config.gscSiteUrl) {
			jobs.push(
				(async () => {
					const r = await fetchJson<{
						rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[];
					}>(
						'gsc',
						`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.gscSiteUrl!)}/searchAnalytics/query`,
						{
							method: 'POST',
							headers: { ...bearer(token), 'Content-Type': 'application/json' },
							body: JSON.stringify({ startDate: range.start, endDate: range.end, dimensions: ['date'], rowLimit: 1000 })
						}
					);
					for (const row of r.rows ?? []) {
						const day = row.keys[0];
						rows.push({ source: 'gsc', metric: 'clicks', day, value: row.clicks });
						rows.push({ source: 'gsc', metric: 'impressions', day, value: row.impressions });
						rows.push({ source: 'gsc', metric: 'position', day, value: row.position });
					}
				})().catch((e) => void warnings.push(`Search Console: ${e.message}`))
			);
		}

		if (config.youtubeChannelId) {
			jobs.push(
				(async () => {
					const p = new URLSearchParams({
						ids: `channel==${config.youtubeChannelId}`,
						startDate: range.start,
						endDate: range.end,
						metrics: 'views,estimatedMinutesWatched,subscribersGained,subscribersLost',
						dimensions: 'day',
						sort: 'day'
					});
					const r = await fetchJson<{ rows?: [string, number, number, number, number][] }>(
						'youtube',
						`https://youtubeanalytics.googleapis.com/v2/reports?${p}`,
						{ headers: bearer(token) }
					);
					for (const [day, views, minutes, gained, lost] of r.rows ?? []) {
						rows.push({ source: 'youtube', metric: 'views', day, value: views });
						rows.push({ source: 'youtube', metric: 'estimatedMinutesWatched', day, value: minutes });
						rows.push({ source: 'youtube', metric: 'subscribersNet', day, value: gained - lost });
					}
				})().catch((e) => void warnings.push(`YouTube: ${e.message}`))
			);
		}

		await Promise.all(jobs);
		return { rows, warnings };
	}
};
