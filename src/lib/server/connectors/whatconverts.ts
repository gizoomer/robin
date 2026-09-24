import { fetchJson, type AccountOption, type Connector, type MetricRow } from './types';

/**
 * WhatConverts (calls, forms and chats, with quote and sales values).
 * Auth is HTTP Basic with an API token + secret from WhatConverts
 * (Account settings > API Keys). A master key sees every client account, so
 * each MYCMO client picks its own WhatConverts profile to report on.
 *
 * Docs: https://www.whatconverts.com/api/overview/
 * Not yet run against a live key: the lead_type / quotable value spellings
 * below are matched loosely for that reason.
 */
const BASE = 'https://app.whatconverts.com/api/v1';
const PER_PAGE = 250;
const MAX_PAGES = 40; // 10,000 leads per sync is plenty for a daily roll-up

export interface WhatConvertsConfig {
	profileId?: string;
	[k: string]: string | undefined;
}

interface Lead {
	date_created?: string;
	lead_type?: string;
	quotable?: string | boolean;
	sales_value?: number | string | null;
	quote_value?: number | string | null;
	profile_id?: number | string;
}

function parseCreds(json: string): { token: string; secret: string } {
	const c = JSON.parse(json);
	if (!c?.token || !c?.secret) throw new Error('WhatConverts API token and secret are required.');
	return c;
}

const auth = (c: { token: string; secret: string }) => ({
	Authorization: `Basic ${Buffer.from(`${c.token}:${c.secret}`).toString('base64')}`
});

const num = (v: unknown) => {
	const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[$,]/g, ''));
	return Number.isFinite(n) ? n : 0;
};

/** Rolls individual leads up into the daily rows the dashboard stores. Exported for tests. */
export function rollUpLeads(leads: Lead[]): MetricRow[] {
	const days = new Map<string, { leads: number; calls: number; forms: number; quotable: number; sales: number }>();
	for (const l of leads) {
		const day = String(l.date_created ?? '').slice(0, 10);
		if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
		const d = days.get(day) ?? { leads: 0, calls: 0, forms: 0, quotable: 0, sales: 0 };
		const type = String(l.lead_type ?? '').toLowerCase();
		d.leads += 1;
		if (type.includes('call')) d.calls += 1;
		if (type.includes('form')) d.forms += 1;
		if (l.quotable === true || String(l.quotable).toLowerCase() === 'yes') d.quotable += 1;
		d.sales += num(l.sales_value);
		days.set(day, d);
	}
	const rows: MetricRow[] = [];
	for (const [day, d] of days) {
		rows.push({ source: 'whatconverts', metric: 'leads', day, value: d.leads });
		rows.push({ source: 'whatconverts', metric: 'calls', day, value: d.calls });
		rows.push({ source: 'whatconverts', metric: 'forms', day, value: d.forms });
		rows.push({ source: 'whatconverts', metric: 'quotable', day, value: d.quotable });
		rows.push({ source: 'whatconverts', metric: 'sales_value', day, value: d.sales });
	}
	return rows;
}

export const whatconverts: Connector<WhatConvertsConfig, { profiles: AccountOption[] }> = {
	provider: 'whatconverts',
	auth: 'apikey',
	credentialFields: [
		{ key: 'token', label: 'API token', help: 'WhatConverts > Account settings > API Keys' },
		{ key: 'secret', label: 'API secret', secret: true }
	],

	async verify(credentials) {
		await fetchJson('whatconverts', `${BASE}/accounts?accounts_per_page=1`, { headers: auth(parseCreds(JSON.stringify(credentials))) });
	},

	async refresh() {
		return null; // API keys don't expire
	},

	async listAccounts(credsJson) {
		const c = parseCreds(credsJson);
		// A profile-level key has no profile list to choose from; the picker then offers "All leads on this key".
		const profiles = await fetchJson<{ profiles?: { profile_id: number | string; profile_name?: string; account_name?: string }[] }>(
			'whatconverts',
			`${BASE}/profiles?profiles_per_page=250`,
			{ headers: auth(c) }
		)
			.then((r) =>
				(r.profiles ?? []).map((p) => ({
					id: String(p.profile_id),
					label: p.account_name ? `${p.profile_name ?? p.profile_id} (${p.account_name})` : String(p.profile_name ?? p.profile_id)
				}))
			)
			.catch(() => [] as AccountOption[]);
		return { profiles };
	},

	async fetchMetrics(credsJson, config, range) {
		const c = parseCreds(credsJson);
		const leads: Lead[] = [];
		const warnings: string[] = [];
		for (let page = 1; page <= MAX_PAGES; page++) {
			const p = new URLSearchParams({
				date_start: `${range.start}T00:00:00Z`,
				date_end: `${range.end}T23:59:59Z`,
				leads_per_page: String(PER_PAGE),
				page_number: String(page)
			});
			if (config.profileId) p.set('profile_id', config.profileId);
			const r = await fetchJson<{ leads?: Lead[]; total_pages?: number }>('whatconverts', `${BASE}/leads?${p}`, { headers: auth(c) });
			leads.push(...(r.leads ?? []));
			if (!r.total_pages || page >= r.total_pages) break;
			if (page === MAX_PAGES) warnings.push(`WhatConverts: stopped after ${MAX_PAGES * PER_PAGE} leads; older days may be incomplete.`);
		}
		return { rows: rollUpLeads(leads), warnings };
	}
};
