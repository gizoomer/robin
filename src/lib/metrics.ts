/**
 * Catalog of every metric the dashboard knows how to show.
 * Connectors write rows keyed by (source, metric); this maps them to labels.
 * Adding a new platform = add its entries here + a connector in $lib/server/connectors.
 */
export type SourceId = 'ga4' | 'gsc' | 'youtube' | 'facebook' | 'instagram' | 'google_ads' | 'meta_ads' | 'whatconverts';

/** Partner apps report under their own source id, e.g. "app:twin". */
export type AppSourceId = `app:${string}`;

export interface MetricDef {
	source: SourceId | AppSourceId;
	metric: string;
	label: string;
	/** 'sum' for flows (sessions per day), 'last' for stocks (follower count) */
	agg: 'sum' | 'last' | 'avg';
	format?: 'number' | 'percent' | 'decimal' | 'duration' | 'money';
	/** false when a lower number is better (e.g. average search position) */
	upIsGood?: boolean;
	/** true when direction is neither good nor bad (e.g. ad spend): delta is shown without color */
	neutral?: boolean;
}

export const SOURCES: Record<SourceId, { label: string; provider: string }> = {
	ga4: { label: 'Website (Google Analytics)', provider: 'google' },
	gsc: { label: 'Google Search', provider: 'google' },
	youtube: { label: 'YouTube', provider: 'google' },
	facebook: { label: 'Facebook', provider: 'meta' },
	instagram: { label: 'Instagram', provider: 'meta' },
	google_ads: { label: 'Google Ads', provider: 'google_ads' },
	meta_ads: { label: 'Meta Ads', provider: 'meta_ads' },
	whatconverts: { label: 'Calls & forms (WhatConverts)', provider: 'whatconverts' }
};

export const METRICS: MetricDef[] = [
	{ source: 'ga4', metric: 'sessions', label: 'Website visits', agg: 'sum' },
	{ source: 'ga4', metric: 'totalUsers', label: 'Visitors', agg: 'sum' },
	{ source: 'ga4', metric: 'keyEvents', label: 'Conversions', agg: 'sum' },
	{ source: 'gsc', metric: 'clicks', label: 'Search clicks', agg: 'sum' },
	{ source: 'gsc', metric: 'impressions', label: 'Search impressions', agg: 'sum' },
	{ source: 'gsc', metric: 'position', label: 'Avg. search position', agg: 'avg', format: 'decimal', upIsGood: false },
	{ source: 'youtube', metric: 'views', label: 'Video views', agg: 'sum' },
	{ source: 'youtube', metric: 'estimatedMinutesWatched', label: 'Minutes watched', agg: 'sum' },
	{ source: 'youtube', metric: 'subscribersNet', label: 'Net subscribers', agg: 'sum' },
	{ source: 'facebook', metric: 'followers', label: 'Page followers', agg: 'last' },
	{ source: 'facebook', metric: 'page_post_engagements', label: 'Post engagements', agg: 'sum' },
	{ source: 'instagram', metric: 'followers', label: 'Followers', agg: 'last' },
	{ source: 'instagram', metric: 'reach', label: 'Accounts reached', agg: 'sum' },
	// Ad spend is also added to marketing spend automatically for ROI. More spend is not "good", so no color.
	{ source: 'google_ads', metric: 'spend', label: 'Google Ads spend', agg: 'sum', format: 'money', neutral: true },
	{ source: 'google_ads', metric: 'clicks', label: 'Ad clicks', agg: 'sum' },
	{ source: 'google_ads', metric: 'conversions', label: 'Ad conversions', agg: 'sum' },
	{ source: 'meta_ads', metric: 'spend', label: 'Meta Ads spend', agg: 'sum', format: 'money', neutral: true },
	{ source: 'meta_ads', metric: 'clicks', label: 'Ad clicks', agg: 'sum' },
	{ source: 'meta_ads', metric: 'leads', label: 'Ad leads', agg: 'sum' },
	{ source: 'whatconverts', metric: 'leads', label: 'Tracked leads', agg: 'sum' },
	{ source: 'whatconverts', metric: 'calls', label: 'Phone calls', agg: 'sum' },
	{ source: 'whatconverts', metric: 'forms', label: 'Form fills', agg: 'sum' },
	{ source: 'whatconverts', metric: 'quotable', label: 'Quotable leads', agg: 'sum' },
	{ source: 'whatconverts', metric: 'sales_value', label: 'Sales value', agg: 'sum', format: 'money' }
];

/** Sources whose `spend` metric counts toward marketing spend on the overview. */
export const AD_SPEND_SOURCES: SourceId[] = ['google_ads', 'meta_ads'];

export function metricDef(source: string, metric: string) {
	return METRICS.find((m) => m.source === source && m.metric === metric);
}

export const LEAD_STAGES = [
	{ id: 'new', label: 'New lead' },
	{ id: 'attempted_contact', label: 'Attempted contact' },
	{ id: 'meeting_scheduled', label: 'Meeting scheduled' },
	{ id: 'proposal_sent', label: 'Proposal sent' },
	{ id: 'closed_won', label: 'Closed won' },
	{ id: 'closed_lost', label: 'Closed lost' }
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number]['id'];

export const LEAD_SOURCES = [
	{ id: 'door_knock', label: 'Door knock' },
	{ id: 'referral', label: 'Referral' },
	{ id: 'web', label: 'Web' },
	{ id: 'phone', label: 'Phone' },
	{ id: 'social', label: 'Social' },
	{ id: 'other', label: 'Other' }
] as const;

export const QUICK_ACTIVITIES = [
	{ id: 'call', label: 'Logged call' },
	{ id: 'voicemail', label: 'Left voicemail' },
	{ id: 'door_knock', label: 'Knocked door' },
	{ id: 'follow_up_scheduled', label: 'Scheduled follow-up' }
] as const;

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const full = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
export const money = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	notation: 'compact',
	maximumFractionDigits: 1
});

export function formatValue(v: number, format: MetricDef['format'] = 'number') {
	if (format === 'percent') return `${(v * 100).toFixed(1)}%`;
	if (format === 'decimal') return v.toFixed(1);
	if (format === 'money') return money.format(v);
	return Math.abs(v) >= 10_000 ? compact.format(v) : full.format(v);
}
