import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Partner API keys look like: mycmo_pk_1a2b3c4d_<43 random chars>
 * The first part (key_prefix) is stored in clear to look the key up;
 * only a SHA-256 of the whole key is stored, so a database leak can't be replayed.
 */
const PREFIX_RE = /^(mycmo_pk_[0-9a-f]{8})_([A-Za-z0-9_-]{43})$/;

export function generateKey() {
	const prefix = `mycmo_pk_${randomBytes(4).toString('hex')}`;
	const key = `${prefix}_${randomBytes(32).toString('base64url')}`;
	return { key, prefix, hash: hashKey(key) };
}

export const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

/** Reads "Authorization: Bearer <key>"; returns null for anything malformed. */
export function parseBearer(header: string | null): { key: string; prefix: string } | null {
	const m = /^Bearer\s+(\S+)$/.exec(header ?? '');
	const parts = m && PREFIX_RE.exec(m[1]);
	return parts ? { key: m![1], prefix: parts[1] } : null;
}

export function hashMatches(key: string, storedHash: string) {
	const a = Buffer.from(hashKey(key), 'hex');
	const b = Buffer.from(storedHash, 'hex');
	return a.length === b.length && timingSafeEqual(a, b);
}

export const MAX_ROWS = 5000;
const MAX_AGE_DAYS = 400;

export interface PartnerRow {
	metric: string;
	day: string;
	value: number;
}

/**
 * Validates a partner's POST body: { "metrics": [{ "metric": "calls", "date": "2026-09-01", "value": 12 }] }
 * Bad rows are reported back by index instead of failing the whole batch.
 */
export function validatePayload(body: unknown, allowed: Set<string>, today = new Date()) {
	const rows: PartnerRow[] = [];
	const rejected: { index: number; reason: string }[] = [];
	const list = (body as { metrics?: unknown })?.metrics;
	if (!Array.isArray(list)) return { rows, rejected, error: 'Body must be JSON: { "metrics": [ { "metric", "date", "value" } ] }' };
	if (list.length > MAX_ROWS) return { rows, rejected, error: `Send at most ${MAX_ROWS} rows per request` };

	const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
	const newest = new Date(t + 86400_000).toISOString().slice(0, 10); // allow tomorrow for timezone drift
	const oldest = new Date(t - MAX_AGE_DAYS * 86400_000).toISOString().slice(0, 10);

	list.forEach((r, index) => {
		const metric = String((r as PartnerRow & { date?: string })?.metric ?? '');
		const day = String((r as { date?: string })?.date ?? '');
		const value = (r as { value?: unknown })?.value;
		if (!allowed.has(metric)) return void rejected.push({ index, reason: `Unknown metric "${metric}". Allowed: ${[...allowed].join(', ')}` });
		if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day + 'T00:00:00Z'))) return void rejected.push({ index, reason: 'date must be YYYY-MM-DD' });
		if (day > newest || day < oldest) return void rejected.push({ index, reason: `date must be within the last ${MAX_AGE_DAYS} days` });
		if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) >= 1e12) return void rejected.push({ index, reason: 'value must be a number' });
		rows.push({ metric, day, value });
	});
	return { rows, rejected, error: null };
}

/** "calls | Phone calls | sum" per line → metric rows. Used by the agency Partner apps page. */
export function parseMetricLines(text: string) {
	const out: { metric: string; label: string; agg: string; format: string | null }[] = [];
	for (const [i, raw] of text.split('\n').entries()) {
		const line = raw.trim();
		if (!line) continue;
		const [metric, label, agg = 'sum', format = ''] = line.split('|').map((x) => x.trim());
		if (!/^[a-z0-9_]{1,48}$/.test(metric ?? '')) throw new Error(`Line ${i + 1}: metric key must be lowercase letters, numbers or _`);
		if (!label) throw new Error(`Line ${i + 1}: add a label after the |`);
		if (!['sum', 'avg', 'last'].includes(agg)) throw new Error(`Line ${i + 1}: total must be sum, avg or last`);
		if (format && !['number', 'money', 'decimal', 'percent'].includes(format)) throw new Error(`Line ${i + 1}: format must be number, money, decimal or percent`);
		out.push({ metric, label, agg, format: format || null });
	}
	return out;
}

