/**
 * DEMO MODE: set DEMO_MODE=true to run the whole app on in-memory sample data,
 * with no Supabase project and no Google/Meta credentials. Used for sales demos
 * and screenshots. Writes (new leads, stage moves, huddles) persist until the
 * server restarts. Never enable this in production.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

export const isDemo = () => env.DEMO_MODE === 'true';

type Row = Record<string, any>;

const ORG = '10000000-0000-0000-0000-000000000001';
const OWNER = '00000000-0000-0000-0000-0000000000b0';
const REPS = [
	{ id: '00000000-0000-0000-0000-0000000000c1', name: 'Maria Lopez' },
	{ id: '00000000-0000-0000-0000-0000000000c2', name: 'James Carter' },
	{ id: '00000000-0000-0000-0000-0000000000c3', name: 'Priya Shah' }
];
const demoUser = { id: OWNER, email: 'owner@demo.mycmo.app', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '' };

// Deterministic PRNG so every run shows the same numbers.
function rng(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000);
const iso = (d: Date) => d.toISOString();
const day = (d: Date) => d.toISOString().slice(0, 10);

function seed(): Record<string, Row[]> {
	const r = rng(42);
	const uuid = (() => {
		let i = 0;
		return (prefix: string) => `${prefix}-0000-4000-8000-${String(++i).padStart(12, '0')}`;
	})();

	const metric_snapshots: Row[] = [];
	const push = (source: string, metric: string, d: Date, value: number) =>
		metric_snapshots.push({ org_id: ORG, source, metric, day: day(d), value });

	for (let i = 62; i >= 1; i--) {
		const d = daysAgo(i);
		const growth = 1 + (62 - i) * 0.006; // steady improvement: the story a client wants to see
		const weekday = [0.7, 1.05, 1.1, 1.08, 1.02, 0.95, 0.75][d.getUTCDay()];
		const noise = () => 0.88 + r() * 0.24;

		const sessions = Math.round(420 * growth * weekday * noise());
		push('ga4', 'sessions', d, sessions);
		push('ga4', 'totalUsers', d, Math.round(sessions * 0.72));
		push('ga4', 'keyEvents', d, Math.round(sessions * 0.026 * noise()));

		const impressions = Math.round(5200 * growth * weekday * noise());
		push('gsc', 'impressions', d, impressions);
		push('gsc', 'clicks', d, Math.round(impressions * 0.029 * noise()));
		push('gsc', 'position', d, +(14.2 - (62 - i) * 0.05 + r() * 0.6).toFixed(1));

		const views = Math.round(310 * growth * noise());
		push('youtube', 'views', d, views);
		push('youtube', 'estimatedMinutesWatched', d, Math.round(views * 2.9 * noise()));
		push('youtube', 'subscribersNet', d, Math.round(1 + r() * 5));

		push('facebook', 'followers', d, 3120 + Math.round((62 - i) * 2.1));
		push('facebook', 'page_post_engagements', d, Math.round(80 * growth * noise()));
		push('instagram', 'followers', d, 5400 + Math.round((62 - i) * 3.4));
		push('instagram', 'reach', d, Math.round(1400 * growth * weekday * noise()));
	}

	const people = [
		['Robert Mills', 'Mills Residence'], ['Angela Brooks', 'Brooks Property Group'], ['Dave Kim', null],
		['Linda Torres', 'Torres Dental'], ['Mark Ellison', null], ['Sofia Nguyen', 'Nguyen Family Trust'],
		['Tom Becker', 'Becker Auto Body'], ['Rachel Green', null], ['Owen Patel', 'Patel Apartments'],
		['Carla Diaz', null], ['Ben Foster', 'Foster & Sons'], ['Nina Hart', null], ['Greg Walsh', 'Walsh HOA'],
		['Emily Stone', null], ['Victor Reyes', 'Reyes Market'], ['Holly Price', null], ['Sam Ortiz', 'Ortiz Storage'],
		['Julia Chen', null], ['Aaron Webb', 'Webb Church'], ['Kate Lin', null]
	] as const;
	const stages = [
		'new', 'new', 'new', 'new', 'attempted_contact', 'attempted_contact', 'attempted_contact',
		'meeting_scheduled', 'meeting_scheduled', 'meeting_scheduled', 'proposal_sent', 'proposal_sent',
		'proposal_sent', 'closed_won', 'closed_won', 'closed_won', 'closed_won', 'closed_lost', 'closed_lost', 'new'
	];
	const sources = ['door_knock', 'referral', 'web', 'phone', 'social'];
	const leads: Row[] = people.map(([name, company], i) => {
		const created = daysAgo(3 + Math.floor(r() * 80));
		const closed = stages[i].startsWith('closed');
		return {
			id: uuid('20000000'),
			org_id: ORG,
			owner_id: REPS[i % 3].id,
			name,
			company,
			phone: `(555) 01${String(10 + i).padStart(2, '0')}`,
			address: `${100 + i * 17} Oak St`,
			source: sources[i % sources.length],
			stage: stages[i],
			estimated_value: Math.round((4 + r() * 24) * 1000),
			created_at: iso(created),
			updated_at: iso(created),
			stage_changed_at: iso(closed ? daysAgo(2 + Math.floor(r() * 25)) : daysAgo(Math.floor(r() * 6)))
		};
	});

	const activities: Row[] = [];
	const types = ['call', 'call', 'voicemail', 'door_knock', 'follow_up_scheduled'];
	for (let i = 0; i < 46; i++) {
		const rep = REPS[i % 7 < 3 ? 0 : i % 7 < 5 ? 1 : 2]; // Maria is the most active
		activities.push({
			id: uuid('40000000'),
			org_id: ORG,
			lead_id: leads[i % leads.length].id,
			user_id: rep.id,
			type: types[i % types.length],
			created_at: iso(daysAgo(r() * 6.5))
		});
	}

	const monthStart = (back: number) => {
		const d = new Date();
		return day(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1)));
	};
	const marketing_spend: Row[] = [];
	for (const back of [0, 1, 2, 3]) {
		for (const [channel, amount] of [['Google Ads', 2500], ['Facebook Ads', 1500], ['SEO retainer', 1200]] as const) {
			marketing_spend.push({ id: uuid('50000000'), org_id: ORG, channel, month: monthStart(back), amount });
		}
	}

	return {
		profiles: [
			{ id: OWNER, full_name: 'Demo Owner', email: demoUser.email, is_agency_staff: false },
			...REPS.map((p) => ({ id: p.id, full_name: p.name, email: `${p.name.split(' ')[0].toLowerCase()}@demo`, is_agency_staff: false }))
		],
		organizations: [{ id: ORG, name: 'Acme Roofing', slug: 'acme', logo_url: null, created_at: iso(daysAgo(120)) }],
		org_members: [
			{ org_id: ORG, user_id: OWNER, role: 'owner' },
			...REPS.map((p) => ({ org_id: ORG, user_id: p.id, role: 'rep' }))
		],
		leads,
		activities,
		huddle_notes: [
			{ id: uuid('60000000'), org_id: ORG, author_id: REPS[0].id, huddle_date: day(daysAgo(0)), created_at: iso(daysAgo(0)),
				wins: 'Closed Torres Dental ($18K). Two new referrals from the Brooks job.', blockers: 'Waiting on insurance adjuster for Mills.', focus: 'Knock the Maple Ridge block after the storm; follow up on 3 proposals.' },
			{ id: uuid('60000000'), org_id: ORG, author_id: REPS[1].id, huddle_date: day(daysAgo(1)), created_at: iso(daysAgo(1)),
				wins: 'Booked 4 inspections from the Facebook ad.', blockers: null, focus: 'Get Patel Apartments proposal out.' }
		],
		marketing_spend,
		integrations: [
			{ id: uuid('30000000'), org_id: ORG, provider: 'google', status: 'connected', account_label: null, last_error: null,
				config: { ga4PropertyId: 'properties/1', gscSiteUrl: 'sc-domain:acmeroofing.com', youtubeChannelId: 'UC-acme' }, last_synced_at: iso(daysAgo(0.3)) },
			{ id: uuid('30000000'), org_id: ORG, provider: 'meta', status: 'connected', account_label: 'Acme Roofing', last_error: null,
				config: { pageId: 'fb-1', pageName: 'Acme Roofing + @acmeroofing', igUserId: 'ig-1' }, last_synced_at: iso(daysAgo(0.3)) }
		],
		metric_snapshots
	};
}

/** Account pickers shown on the Connections page in demo mode. */
export const demoAccountOptions = {
	google: {
		ga4: [{ id: 'properties/1', label: 'acmeroofing.com (Acme Roofing)' }],
		gsc: [{ id: 'sc-domain:acmeroofing.com', label: 'sc-domain:acmeroofing.com' }],
		youtube: [{ id: 'UC-acme', label: 'Acme Roofing TV' }]
	},
	meta: { pages: [{ id: 'fb-1', label: 'Acme Roofing + @acmeroofing', igUserId: 'ig-1' }] }
};

const PRIMARY_KEYS: Record<string, string[]> = {
	org_members: ['org_id', 'user_id'],
	metric_snapshots: ['org_id', 'source', 'metric', 'day'],
	integration_secrets: ['integration_id']
};

let db: Record<string, Row[]> | null = null;
const store = () => (db ??= seed());

/** Minimal stand-in for the supabase-js query builder, covering what this app uses. */
class Query implements PromiseLike<{ data: any; error: any }> {
	private filters: ((r: Row) => boolean)[] = [];
	private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
	private payload: any;
	private conflict?: string[];
	private returning = false;
	private sorts: [string, boolean][] = [];
	private max?: number;
	private mode: 'many' | 'single' | 'maybe' = 'many';

	constructor(private table: string) {}

	select() {
		if (this.op !== 'select') this.returning = true;
		return this;
	}
	insert(rows: Row | Row[]) {
		this.op = 'insert';
		this.payload = rows;
		return this;
	}
	update(patch: Row) {
		this.op = 'update';
		this.payload = patch;
		return this;
	}
	upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
		this.op = 'upsert';
		this.payload = rows;
		this.conflict = opts?.onConflict?.split(',');
		return this;
	}
	delete() {
		this.op = 'delete';
		return this;
	}
	eq(c: string, v: unknown) {
		this.filters.push((r) => r[c] === v);
		return this;
	}
	gte(c: string, v: string) {
		this.filters.push((r) => String(r[c]) >= v);
		return this;
	}
	in(c: string, v: unknown[]) {
		this.filters.push((r) => v.includes(r[c]));
		return this;
	}
	or() {
		return this; // only used to trim old closed deals from the board; harmless to skip in a demo
	}
	order(c: string, o?: { ascending?: boolean }) {
		this.sorts.push([c, o?.ascending ?? true]);
		return this;
	}
	limit(n: number) {
		this.max = n;
		return this;
	}
	single() {
		this.mode = 'single';
		return this;
	}
	maybeSingle() {
		this.mode = 'maybe';
		return this;
	}

	private run(): { data: any; error: any } {
		const all = (store()[this.table] ??= []);
		const match = (r: Row) => this.filters.every((f) => f(r));
		let rows: Row[] = [];

		if (this.op === 'select') {
			rows = all.filter(match);
			for (const [c, asc] of [...this.sorts].reverse()) {
				rows = [...rows].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1));
			}
			if (this.max != null) rows = rows.slice(0, this.max);
		} else if (this.op === 'insert' || this.op === 'upsert') {
			const keys = this.conflict ?? PRIMARY_KEYS[this.table] ?? ['id'];
			for (const input of [this.payload].flat()) {
				const existing = this.op === 'upsert' ? all.find((r) => keys.every((k) => r[k] === input[k])) : undefined;
				if (existing) {
					Object.assign(existing, input);
					rows.push(existing);
				} else {
					const now = new Date().toISOString();
					const row = { id: crypto.randomUUID(), created_at: now, updated_at: now, stage_changed_at: now, ...input };
					if (this.table === 'leads') row.stage ??= 'new';
					if (this.table === 'huddle_notes') row.huddle_date ??= now.slice(0, 10);
					all.push(row);
					rows.push(row);
				}
			}
		} else if (this.op === 'update') {
			rows = all.filter(match);
			for (const r of rows) {
				if (this.table === 'leads' && this.payload.stage && this.payload.stage !== r.stage) {
					r.stage_changed_at = new Date().toISOString();
				}
				Object.assign(r, this.payload);
			}
		} else {
			rows = all.filter(match);
			store()[this.table] = all.filter((r) => !match(r));
		}

		if (this.op !== 'select' && !this.returning) return { data: null, error: null };
		if (this.mode === 'many') return { data: rows, error: null };
		if (rows.length === 0 && this.mode === 'single') return { data: null, error: { message: 'No rows', code: 'PGRST116' } };
		return { data: rows[0] ?? null, error: null };
	}

	then<A = { data: any; error: any }, B = never>(
		ok?: ((v: { data: any; error: any }) => A | PromiseLike<A>) | null,
		fail?: ((e: unknown) => B | PromiseLike<B>) | null
	) {
		return Promise.resolve().then(() => this.run()).then(ok, fail);
	}
}

export function demoClient(): SupabaseClient {
	const session = { user: demoUser, access_token: 'demo', refresh_token: 'demo', expires_in: 3600, token_type: 'bearer' };
	return {
		from: (table: string) => new Query(table),
		auth: {
			getSession: async () => ({ data: { session }, error: null }),
			getUser: async () => ({ data: { user: demoUser }, error: null }),
			signInWithOtp: async () => ({ error: null }),
			exchangeCodeForSession: async () => ({ error: null }),
			signOut: async () => ({ error: null })
		}
	} as unknown as SupabaseClient;
}
