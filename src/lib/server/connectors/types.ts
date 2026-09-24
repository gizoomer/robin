export interface TokenSet {
	accessToken: string;
	refreshToken?: string | null;
	expiresAt?: Date | null;
}

export interface MetricRow {
	source: string;
	metric: string;
	day: string; // YYYY-MM-DD
	value: number;
}

export interface AccountOption {
	id: string;
	label: string;
}

export interface DateRange {
	start: string; // YYYY-MM-DD inclusive
	end: string; // YYYY-MM-DD inclusive
}

export interface Connector<Config = Record<string, string | undefined>, Accounts = Record<string, AccountOption[]>> {
	provider: 'google' | 'meta';
	authorizeUrl(state: string, redirectUri: string): string;
	exchangeCode(code: string, redirectUri: string): Promise<TokenSet>;
	/** Returns fresh tokens, or null when the provider has no refresh flow (user must reconnect). */
	refresh(tokens: TokenSet): Promise<TokenSet | null>;
	/** What the client can pick from after connecting (GA4 properties, pages, ...). */
	listAccounts(accessToken: string): Promise<Accounts>;
	fetchMetrics(accessToken: string, config: Config, range: DateRange): Promise<{ rows: MetricRow[]; warnings: string[] }>;
}

export class ProviderError extends Error {
	constructor(
		public provider: string,
		public status: number,
		message: string
	) {
		super(`${provider} ${status}: ${message}`);
	}
}

export async function fetchJson<T>(provider: string, url: string, init?: RequestInit): Promise<T> {
	const res = await fetch(url, init);
	const text = await res.text();
	if (!res.ok) {
		let msg = text.slice(0, 300);
		try {
			const j = JSON.parse(text);
			msg = j.error?.message ?? j.error_description ?? msg;
		} catch {
			/* not json */
		}
		throw new ProviderError(provider, res.status, msg);
	}
	return JSON.parse(text) as T;
}

export function isoDay(d: Date) {
	return d.toISOString().slice(0, 10);
}
