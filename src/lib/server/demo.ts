/**
 * DEMO MODE: set DEMO_MODE=true to run the whole app on in-memory sample data,
 * with no Supabase project and no Google/Meta credentials. Used for sales demos.
 *
 * The sample agency has 20 clients with 3-4 employees each. Visit /demo to
 * pick who to sign in as (the super admin, or any client's owner/rep/viewer).
 * The in-memory client mimics the RLS rules in supabase/migrations so each
 * persona sees exactly what they would in production.
 *
 * Writes persist until the server restarts. Never enable this in production.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

export const isDemo = () => env.DEMO_MODE === 'true';
export const DEMO_COOKIE = 'mycmo_demo_user';

type Row = Record<string, any>;

export const SUPER_ADMIN = '00000000-0000-4000-8000-000000000001';

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
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// name, industry, deal size ($K), traffic scale, momentum (+ growing / - shrinking), connected providers
const CLIENTS: [string, string, number, number, number, string[]][] = [
	['Acme Roofing', 'Roofing', 14, 1.0, 1, ['google', 'meta', 'google_ads', 'meta_ads']],
	['Bright Smile Dental', 'Dental', 6, 0.7, 1, ['google', 'meta', 'google_ads']],
	['Summit HVAC', 'HVAC', 9, 0.9, 1, ['google', 'google_ads']],
	['Harbor Law Group', 'Legal', 22, 0.5, 0.5, ['google', 'meta']],
	['Evergreen Landscaping', 'Landscaping', 5, 0.6, 1, ['google', 'meta', 'meta_ads']],
	['Peak Fitness Studio', 'Fitness', 1.2, 0.8, -1, ['google', 'meta', 'meta_ads']],
	['Coastal Realty', 'Real estate', 18, 1.3, 1, ['google', 'meta', 'google_ads', 'meta_ads']],
	['Blue Ridge Plumbing', 'Plumbing', 4, 0.8, 1, ['google', 'google_ads']],
	['Urban Bites Catering', 'Catering', 3, 0.4, 0.5, ['google', 'meta']],
	['Northside Auto Repair', 'Auto repair', 2, 0.6, -0.5, ['google']],
	['Lumen Med Spa', 'Med spa', 2.5, 0.7, 1, ['google', 'meta', 'meta_ads']],
	['Keystone Builders', 'Construction', 45, 0.4, 1, ['google', 'google_ads']],
	['Silver Oak Senior Living', 'Senior care', 30, 0.5, 0.5, ['google', 'meta']],
	['Prairie Solar', 'Solar', 26, 0.9, 1, ['google', 'meta', 'google_ads', 'meta_ads']],
	['Metro Pest Control', 'Pest control', 1.5, 0.7, 0.5, ['google', 'google_ads']],
	['Willow Veterinary', 'Veterinary', 1, 0.6, 1, ['google', 'meta']],
	['Titan Garage Doors', 'Garage doors', 3, 0.5, -1, ['google']],
	['Clearview Windows', 'Windows', 12, 0.8, 1, ['google', 'meta', 'meta_ads']],
	['Redline Moving Co.', 'Moving', 2.2, 0.6, 0.5, ['google', 'google_ads']],
	['Horizon Financial', 'Financial advice', 8, 0.5, 0, []] // just signed: nothing connected yet
];

const FIRST = ['Maria', 'James', 'Priya', 'Carlos', 'Aisha', 'Tom', 'Grace', 'Omar', 'Leah', 'Victor', 'Nina', 'Derek', 'Sofia', 'Ben', 'Hana', 'Luis', 'Zoe', 'Ravi', 'Emma', 'Jake'];
const LAST = ['Lopez', 'Carter', 'Shah', 'Nguyen', 'Brooks', 'Reed', 'Kim', 'Patel', 'Diaz', 'Hughes', 'Ward', 'Singh', 'Ellis', 'Moreno', 'Fox'];
const LEAD_NAMES = ['Robert Mills', 'Angela Brooks', 'Dave Kim', 'Linda Torres', 'Mark Ellison', 'Sofia Nguyen', 'Tom Becker', 'Rachel Green', 'Owen Patel', 'Carla Diaz', 'Ben Foster', 'Nina Hart', 'Greg Walsh', 'Emily Stone', 'Victor Reyes', 'Holly Price', 'Sam Ortiz', 'Julia Chen', 'Aaron Webb', 'Kate Lin', 'Paula Grant', 'Ian Brooks', 'Maya Cole', 'Eric Tran'];

function seed() {
	const r = rng(42);
	let n = 0;
	const uuid = (group: number) => `${String(group).padStart(8, '0')}-0000-4000-8000-${String(++n).padStart(12, '0')}`;

	const db: Record<string, Row[]> = {
		profiles: [{ id: SUPER_ADMIN, full_name: 'You (CMO)', email: 'cmo@youragency.com', is_agency_staff: true }],
		organizations: [],
		org_members: [],
		leads: [],
		activities: [],
		huddle_notes: [],
		marketing_spend: [],
		integrations: [],
		integration_secrets: [],
		metric_snapshots: [],
		org_kpis: []
	};

	const monthStart = (back: number) => {
		const d = new Date();
		return day(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1)));
	};

	CLIENTS.forEach(([name, industry, dealK, scale, momentum, providers], ci) => {
		const orgId = uuid(10);
		const slug = slugify(name);
		db.organizations.push({ id: orgId, name, slug, industry, status: 'active', logo_url: null, created_at: iso(daysAgo(400 - ci * 15)) });

		// 3-4 employees: owner, 1-2 reps, sometimes a viewer (e.g. office manager).
		const roles = ['owner', 'rep', 'rep', ...(ci % 3 === 0 ? [] : ['viewer'])];
		const staff = roles.map((role, i) => {
			const first = FIRST[(ci * 3 + i) % FIRST.length];
			const last = LAST[(ci * 7 + i * 3) % LAST.length];
			const id = uuid(20);
			db.profiles.push({ id, full_name: `${first} ${last}`, email: `${first.toLowerCase()}@${slug}.com`, is_agency_staff: false });
			db.org_members.push({ org_id: orgId, user_id: id, role, created_at: iso(daysAgo(300)) });
			return { id, role };
		});
		const sellers = staff.filter((s) => s.role !== 'viewer');

		// Leads and pipeline
		const leadCount = 10 + Math.floor(r() * 14);
		const stageBag = ['new', 'new', 'new', 'attempted_contact', 'attempted_contact', 'meeting_scheduled', 'meeting_scheduled', 'proposal_sent', 'proposal_sent', 'closed_won', 'closed_won', 'closed_lost', 'closed_lost'];
		const sources = ['door_knock', 'referral', 'web', 'phone', 'social'];
		const leadIds: string[] = [];
		for (let i = 0; i < leadCount; i++) {
			const stage = stageBag[Math.floor(r() * stageBag.length)];
			const created = daysAgo(2 + Math.floor(r() * 80));
			const id = uuid(30);
			leadIds.push(id);
			db.leads.push({
				id,
				org_id: orgId,
				owner_id: sellers[i % sellers.length].id,
				name: LEAD_NAMES[(ci * 5 + i) % LEAD_NAMES.length],
				company: r() > 0.5 ? `${LAST[(ci + i) % LAST.length]} ${['Holdings', 'Residence', 'LLC', 'Group'][i % 4]}` : null,
				phone: `(555) ${String(100 + ci).slice(-3)}-${String(1000 + i * 37).slice(-4)}`,
				address: `${100 + i * 17} Main St`,
				source: sources[Math.floor(r() * sources.length)],
				stage,
				estimated_value: Math.round(dealK * (0.5 + r()) * 1000),
				created_at: iso(created),
				updated_at: iso(created),
				stage_changed_at: iso(daysAgo(stage.startsWith('closed') ? 2 + Math.floor(r() * 25) : Math.floor(r() * 6)))
			});
		}
		const types = ['call', 'call', 'voicemail', 'door_knock', 'follow_up_scheduled', 'email'];
		for (let i = 0; i < 8 + Math.floor(r() * 30); i++) {
			db.activities.push({
				id: uuid(40),
				org_id: orgId,
				lead_id: leadIds[i % leadIds.length],
				user_id: sellers[Math.floor(r() * sellers.length)].id,
				type: types[i % types.length],
				created_at: iso(daysAgo(r() * 6.5))
			});
		}

		db.huddle_notes.push({
			id: uuid(50), org_id: orgId, author_id: sellers[0].id, huddle_date: day(daysAgo(ci % 3)), created_at: iso(daysAgo(ci % 3)),
			wins: `Closed ${LEAD_NAMES[ci % LEAD_NAMES.length]} ($${Math.round(dealK * 1.1)}K). Two new referrals this week.`,
			blockers: ci % 2 ? 'Waiting on a financing approval for one proposal.' : null,
			focus: 'Follow up on every open proposal before Friday.'
		});

		// Non-ad spend entered by hand (ad spend is synced from the platforms).
		for (const back of [0, 1, 2, 3]) {
			db.marketing_spend.push({ id: uuid(60), org_id: orgId, channel: 'SEO retainer', month: monthStart(back), amount: Math.round(800 + dealK * 40) });
		}

		// Integrations and daily metrics
		const brokenMeta = name === 'Harbor Law Group'; // one client needs a reconnect, so the portfolio shows an alert
		for (const provider of providers) {
			db.integrations.push({
				id: uuid(70), org_id: orgId, provider,
				status: brokenMeta && provider === 'meta' ? 'error' : 'connected',
				last_error: brokenMeta && provider === 'meta' ? 'Access expired. Reconnect this account.' : null,
				account_label: null, config: { demo: 'true' }, connected_by: SUPER_ADMIN,
				last_synced_at: iso(daysAgo(brokenMeta && provider === 'meta' ? 9 : 0.3))
			});
		}
		const has = (p: string) => providers.includes(p);
		const push = (source: string, metric: string, d: Date, value: number) =>
			db.metric_snapshots.push({ org_id: orgId, source, metric, day: day(d), value });

		for (let i = 62; i >= 1; i--) {
			const d = daysAgo(i);
			const growth = 1 + (62 - i) * 0.005 * momentum;
			const wk = [0.7, 1.05, 1.1, 1.08, 1.02, 0.95, 0.75][d.getUTCDay()];
			const nz = () => 0.88 + r() * 0.24;
			if (has('google')) {
				const sessions = Math.round(420 * scale * growth * wk * nz());
				push('ga4', 'sessions', d, sessions);
				push('ga4', 'totalUsers', d, Math.round(sessions * 0.72));
				push('ga4', 'keyEvents', d, Math.round(sessions * 0.026 * nz()));
				const impressions = Math.round(5200 * scale * growth * wk * nz());
				push('gsc', 'impressions', d, impressions);
				push('gsc', 'clicks', d, Math.round(impressions * 0.029 * nz()));
				push('gsc', 'position', d, +(14.2 - (62 - i) * 0.04 * momentum + r() * 0.6).toFixed(1));
				if (ci % 4 === 0) {
					const views = Math.round(310 * scale * growth * nz());
					push('youtube', 'views', d, views);
					push('youtube', 'estimatedMinutesWatched', d, Math.round(views * 2.9 * nz()));
					push('youtube', 'subscribersNet', d, Math.round(1 + r() * 5));
				}
			}
			if (has('meta') && !(brokenMeta && i < 9)) {
				push('facebook', 'followers', d, Math.round(3120 * scale) + Math.round((62 - i) * 2.1 * momentum));
				push('facebook', 'page_post_engagements', d, Math.round(80 * scale * growth * nz()));
				push('instagram', 'followers', d, Math.round(5400 * scale) + Math.round((62 - i) * 3.4 * momentum));
				push('instagram', 'reach', d, Math.round(1400 * scale * growth * wk * nz()));
			}
			if (has('google_ads')) {
				const spend = +(85 * scale * nz()).toFixed(2);
				const clicks = Math.round(spend / 3.1 * nz());
				push('google_ads', 'spend', d, spend);
				push('google_ads', 'clicks', d, clicks);
				push('google_ads', 'impressions', d, clicks * 22);
				push('google_ads', 'conversions', d, Math.round(clicks * 0.07 * growth * nz()));
			}
			if (has('meta_ads')) {
				const spend = +(55 * scale * nz()).toFixed(2);
				const clicks = Math.round(spend / 1.4 * nz());
				push('meta_ads', 'spend', d, spend);
				push('meta_ads', 'clicks', d, clicks);
				push('meta_ads', 'impressions', d, clicks * 60);
				push('meta_ads', 'leads', d, Math.round(clicks * 0.05 * growth * nz()));
			}
		}

		// Headline KPIs the agency picked for this client, with monthly goals.
		const kpis: [string, string, number][] = [];
		if (has('google')) kpis.push(['ga4', 'sessions', Math.round(13000 * scale * 1.1)], ['ga4', 'keyEvents', Math.round(340 * scale * 1.1)]);
		if (has('google_ads')) kpis.push(['google_ads', 'conversions', Math.round(620 * scale / 10)]);
		if (has('meta_ads')) kpis.push(['meta_ads', 'leads', Math.round(1200 * scale / 20)]);
		if (has('meta') && kpis.length < 4) kpis.push(['instagram', 'reach', Math.round(40000 * scale)]);
		if (has('google') && kpis.length < 4) kpis.push(['gsc', 'clicks', Math.round(4500 * scale)]);
		kpis.slice(0, 4).forEach(([source, metric, target], position) =>
			db.org_kpis.push({ org_id: orgId, source, metric, position, monthly_target: target })
		);
	});

	return db;
}

/** Account pickers shown on the Connections page in demo mode. */
export function demoAccountOptions(provider: string, orgName: string): Record<string, { id: string; label: string; igUserId?: string }[]> {
	const site = slugify(orgName).replace(/-/g, '');
	switch (provider) {
		case 'google':
			return {
				ga4: [{ id: 'properties/1', label: `${site}.com (${orgName})` }],
				gsc: [{ id: `sc-domain:${site}.com`, label: `sc-domain:${site}.com` }],
				youtube: [{ id: 'UC-demo', label: `${orgName} TV` }]
			};
		case 'meta':
			return { pages: [{ id: 'fb-1', label: `${orgName} + @${site}`, igUserId: 'ig-1' }] };
		case 'google_ads':
			return { customers: [{ id: '1234567890', label: `123-456-7890 (${orgName})` }] };
		case 'meta_ads':
			return { adAccounts: [{ id: 'act_1', label: `${orgName} ad account` }] };
		default:
			return {};
	}
}

let db: ReturnType<typeof seed> | null = null;
const store = () => (db ??= seed());

/** Who the demo can sign in as, for the /demo picker. */
export function demoPersonas() {
	const s = store();
	const name = (id: string) => s.profiles.find((p) => p.id === id)?.full_name ?? '';
	return s.organizations
		.map((o) => ({
			org: o.name,
			slug: o.slug,
			people: s.org_members
				.filter((m) => m.org_id === o.id)
				.map((m) => ({ id: m.user_id, name: name(m.user_id), role: m.role as string }))
		}))
		.sort((a, b) => a.org.localeCompare(b.org));
}

export function demoUserExists(id: string) {
	return store().profiles.some((p) => p.id === id);
}

const PRIMARY_KEYS: Record<string, string[]> = {
	org_members: ['org_id', 'user_id'],
	metric_snapshots: ['org_id', 'source', 'metric', 'day'],
	org_kpis: ['org_id', 'source', 'metric'],
	integration_secrets: ['integration_id']
};

// Which role is needed to write each org-scoped table (mirrors the SQL policies).
const WRITE_NEEDS: Record<string, 'manage' | 'work'> = {
	organizations: 'manage',
	org_members: 'manage',
	integrations: 'manage',
	marketing_spend: 'manage',
	org_kpis: 'manage',
	leads: 'work',
	activities: 'work',
	huddle_notes: 'work'
};

interface Viewer {
	id: string;
	bypass: boolean; // service role
}

function access(v: Viewer) {
	const s = store();
	const agency = v.bypass || !!s.profiles.find((p) => p.id === v.id)?.is_agency_staff;
	const roles = new Map<string, string>(s.org_members.filter((m) => m.user_id === v.id).map((m) => [m.org_id, m.role]));
	return {
		canView: (org: string) => agency || roles.has(org),
		canWork: (org: string) => agency || ['owner', 'rep'].includes(roles.get(org) ?? ''),
		canManage: (org: string) => agency || roles.get(org) === 'owner',
		agency,
		roles
	};
}

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

	constructor(
		private table: string,
		private viewer: Viewer
	) {}

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
	neq(c: string, v: unknown) {
		this.filters.push((r) => r[c] !== v);
		return this;
	}
	is(c: string, v: null) {
		this.filters.push((r) => (r[c] ?? null) === v);
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

	/** Row-level security, mirroring supabase/migrations. */
	private visible(r: Row, a: ReturnType<typeof access>) {
		if (this.table === 'integration_secrets') return this.viewer.bypass;
		if (this.table === 'organizations') return a.canView(r.id);
		if (this.table === 'profiles') {
			if (a.agency || r.id === this.viewer.id) return true;
			return store().org_members.some((m) => m.user_id === r.id && a.roles.has(m.org_id));
		}
		return 'org_id' in r ? a.canView(r.org_id) : true;
	}

	private writable(r: Row, a: ReturnType<typeof access>) {
		if (this.viewer.bypass) return true;
		const org = this.table === 'organizations' ? r.id : r.org_id;
		if (this.table === 'profiles') return r.id === this.viewer.id;
		if (this.table === 'organizations' && this.op === 'insert') return a.agency;
		const need = WRITE_NEEDS[this.table];
		if (!need) return false;
		if (need === 'manage') return a.canManage(org);
		if (this.table === 'leads' && (this.op === 'update' || this.op === 'delete')) {
			return a.canManage(org) || (a.canWork(org) && this.op === 'update' && (r.owner_id === this.viewer.id || r.owner_id == null));
		}
		return a.canWork(org);
	}

	private run(): { data: any; error: any } {
		const s = store() as Record<string, Row[]>;
		const all = (s[this.table] ??= []);
		const a = access(this.viewer);
		const match = (r: Row) => this.visible(r, a) && this.filters.every((f) => f(r));
		const denied = { data: null, error: { message: 'new row violates row-level security policy', code: '42501' } };
		let rows: Row[] = [];

		if (this.op === 'select') {
			rows = all.filter(match);
			for (const [c, asc] of [...this.sorts].reverse()) {
				rows = [...rows].sort((x, y) => (x[c] > y[c] ? 1 : x[c] < y[c] ? -1 : 0) * (asc ? 1 : -1));
			}
			if (this.max != null) rows = rows.slice(0, this.max);
		} else if (this.op === 'insert' || this.op === 'upsert') {
			const keys = this.conflict ?? PRIMARY_KEYS[this.table] ?? ['id'];
			const inputs = [this.payload].flat();
			if (this.table === 'organizations' && inputs.some((i) => all.some((o) => o.slug === i.slug))) {
				return { data: null, error: { message: 'duplicate key', code: '23505' } };
			}
			for (const input of inputs) {
				const existing = this.op === 'upsert' ? all.find((r) => keys.every((k) => r[k] === input[k])) : undefined;
				if (!this.writable(existing ?? input, a)) return denied;
				if (existing) {
					Object.assign(existing, input);
					rows.push(existing);
				} else {
					const now = new Date().toISOString();
					const row: Row = { id: crypto.randomUUID(), created_at: now, updated_at: now, ...input };
					if (this.table === 'leads') {
						row.stage ??= 'new';
						row.stage_changed_at ??= now;
					}
					if (this.table === 'huddle_notes') row.huddle_date ??= now.slice(0, 10);
					if (this.table === 'organizations') row.status ??= 'active';
					if (this.table === 'integrations') row.config ??= {};
					all.push(row);
					rows.push(row);
				}
			}
		} else if (this.op === 'update') {
			rows = all.filter((r) => match(r) && this.writable(r, a));
			for (const r of rows) {
				if (this.table === 'leads' && this.payload.stage && this.payload.stage !== r.stage) {
					r.stage_changed_at = new Date().toISOString();
				}
				Object.assign(r, this.payload);
			}
		} else {
			rows = all.filter((r) => match(r) && this.writable(r, a));
			s[this.table] = all.filter((r) => !rows.includes(r));
			if (this.table === 'integrations') {
				s.integration_secrets = s.integration_secrets.filter((x) => !rows.some((r) => r.id === x.integration_id));
			}
			if (this.table === 'organizations') {
				for (const t of Object.keys(s)) if (t !== 'organizations') s[t] = s[t].filter((x) => !rows.some((r) => r.id === x.org_id));
			}
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

/**
 * userId = the signed-in persona (null = signed out).
 * bypass = act as the service role, like supabaseAdmin() in production.
 */
export function demoClient(userId: string | null, bypass = false): SupabaseClient {
	const viewer: Viewer = { id: userId ?? '', bypass };
	const profile = () => store().profiles.find((p) => p.id === userId);
	const user = () => {
		const p = profile();
		return p ? { id: p.id, email: p.email, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '' } : null;
	};
	return {
		from: (table: string) => new Query(table, viewer),
		auth: {
			getSession: async () => ({ data: { session: user() ? { user: user(), access_token: 'demo' } : null }, error: null }),
			getUser: async () => ({ data: { user: user() }, error: user() ? null : { message: 'Signed out' } }),
			signInWithOtp: async () => ({ error: null }),
			exchangeCodeForSession: async () => ({ error: null }),
			signOut: async () => ({ error: null }),
			admin: {
				// Mirrors auth.admin.inviteUserByEmail: creates the user (and, via trigger, the profile).
				inviteUserByEmail: async (email: string, opts?: { data?: { full_name?: string } }) => {
					const s = store();
					if (s.profiles.some((p) => p.email === email)) {
						return { data: { user: null }, error: { message: 'A user with this email address has already been registered' } };
					}
					const id = crypto.randomUUID();
					s.profiles.push({ id, email, full_name: opts?.data?.full_name || email.split('@')[0], is_agency_staff: false });
					return { data: { user: { id, email } }, error: null };
				}
			}
		}
	} as unknown as SupabaseClient;
}
