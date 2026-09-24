import { describe, expect, it } from 'vitest';
import { generateKey, hashMatches, parseBearer, validatePayload } from './partner';

describe('partner keys', () => {
	it('generates keys that parse and verify', () => {
		const { key, prefix, hash } = generateKey();
		const parsed = parseBearer(`Bearer ${key}`);
		expect(parsed).toEqual({ key, prefix });
		expect(hashMatches(key, hash)).toBe(true);
		expect(hashMatches(key.slice(0, -1) + (key.endsWith('A') ? 'B' : 'A'), hash)).toBe(false);
	});

	it('rejects malformed headers', () => {
		expect(parseBearer(null)).toBeNull();
		expect(parseBearer('Bearer nope')).toBeNull();
		expect(parseBearer('Basic mycmo_pk_1a2b3c4d_' + 'x'.repeat(43))).toBeNull();
	});
});

describe('partner payload', () => {
	const allowed = new Set(['calls', 'reviews']);
	const today = new Date('2026-09-24T12:00:00Z');

	it('accepts good rows and reports bad ones by index', () => {
		const r = validatePayload(
			{
				metrics: [
					{ metric: 'calls', date: '2026-09-23', value: 12 },
					{ metric: 'bogus', date: '2026-09-23', value: 1 },
					{ metric: 'calls', date: '23/09/2026', value: 1 },
					{ metric: 'reviews', date: '2024-01-01', value: 1 },
					{ metric: 'reviews', date: '2026-09-22', value: '5' }
				]
			},
			allowed,
			today
		);
		expect(r.error).toBeNull();
		expect(r.rows).toEqual([{ metric: 'calls', day: '2026-09-23', value: 12 }]);
		expect(r.rejected.map((x) => x.index)).toEqual([1, 2, 3, 4]);
	});

	it('rejects a body without a metrics array', () => {
		expect(validatePayload({ foo: 1 }, allowed, today).error).toMatch(/metrics/);
	});
});
