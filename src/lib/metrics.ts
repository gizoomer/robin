/**
 * Catalog of every metric the dashboard knows how to show.
 * Connectors write rows keyed by (source, metric); this maps them to labels.
 * Adding a new platform = add its entries here + a connector in $lib/server/connectors.
 */
export type SourceId = 'ga4' | 'gsc' | 'youtube' | 'facebook' | 'instagram';

export interface MetricDef {
	source: SourceId;
	metric: string;
	label: string;
	/** 'sum' for flows (sessions per day), 'last' for stocks (follower count) */
	agg: 'sum' | 'last' | 'avg';
	format?: 'number' | 'percent' | 'decimal' | 'duration';
	/** false when a lower number is better (e.g. average search position) */
	upIsGood?: boolean;
}

export const SOURCES: Record<SourceId, { label: string; provider: 'google' | 'meta' }> = {
	ga4: { label: 'Website (Google Analytics)', provider: 'google' },
	gsc: { label: 'Google Search', provider: 'google' },
	youtube: { label: 'YouTube', provider: 'google' },
	facebook: { label: 'Facebook', provider: 'meta' },
	instagram: { label: 'Instagram', provider: 'meta' }
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
	{ source: 'instagram', metric: 'reach', label: 'Accounts reached', agg: 'sum' }
];

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
	return Math.abs(v) >= 10_000 ? compact.format(v) : full.format(v);
}
