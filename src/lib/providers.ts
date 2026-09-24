/**
 * Every platform MYCMO can (or will) connect to. The Connections page renders
 * straight from this list, so shipping a new connector means: write it in
 * $lib/server/connectors, flip `available` to true, and add its metrics.
 */
export interface Picker {
	key: string; // key in the connector's listAccounts() result
	field: string; // key stored in integrations.config
	label: string;
	/** Label for the empty choice. Defaults to "Don't track". */
	emptyLabel?: string;
}

export interface ProviderInfo {
	id: string;
	name: string;
	covers: string;
	category: 'analytics' | 'social' | 'ads' | 'calls' | 'local';
	available: boolean;
	/** 'apikey' platforms take pasted credentials instead of a sign-in redirect. */
	auth?: 'oauth' | 'apikey';
	pickers: Picker[];
}

export const PROVIDERS: ProviderInfo[] = [
	{
		id: 'google',
		name: 'Google',
		covers: 'Google Analytics 4, Search Console, YouTube',
		category: 'analytics',
		available: true,
		pickers: [
			{ key: 'ga4', field: 'ga4PropertyId', label: 'Google Analytics property' },
			{ key: 'gsc', field: 'gscSiteUrl', label: 'Search Console site' },
			{ key: 'youtube', field: 'youtubeChannelId', label: 'YouTube channel' }
		]
	},
	{
		id: 'meta',
		name: 'Meta',
		covers: 'Facebook Page, Instagram Business',
		category: 'social',
		available: true,
		pickers: [{ key: 'pages', field: 'pageId', label: 'Facebook Page (and linked Instagram)' }]
	},
	{
		id: 'google_ads',
		name: 'Google Ads',
		covers: 'Spend, clicks, conversions, cost per conversion',
		category: 'ads',
		available: true,
		pickers: [{ key: 'customers', field: 'customerId', label: 'Google Ads account' }]
	},
	{
		id: 'meta_ads',
		name: 'Meta Ads',
		covers: 'Facebook + Instagram ad spend, clicks, leads',
		category: 'ads',
		available: true,
		pickers: [{ key: 'adAccounts', field: 'adAccountId', label: 'Ad account' }]
	},
	{ id: 'tiktok_ads', name: 'TikTok Ads', covers: 'Spend, views, conversions', category: 'ads', available: false, pickers: [] },
	{ id: 'linkedin_ads', name: 'LinkedIn Ads', covers: 'Spend, leads, CPL', category: 'ads', available: false, pickers: [] },
	{ id: 'gbp', name: 'Google Business Profile', covers: 'Calls, direction requests, reviews', category: 'local', available: false, pickers: [] },
	{
		id: 'whatconverts',
		name: 'WhatConverts',
		covers: 'Calls, forms and chats, quotable leads and sales value',
		category: 'calls',
		available: true,
		auth: 'apikey',
		pickers: [{ key: 'profiles', field: 'profileId', label: 'WhatConverts profile', emptyLabel: 'All leads on this API key' }]
	}
];

export const providerInfo = (id: string) => PROVIDERS.find((p) => p.id === id);
