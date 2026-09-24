import { describe, expect, it } from 'vitest';
import { parseMetricLines } from '$lib/server/partner';

describe('partner metric lines', () => {
	it('parses key | label | total | format', () => {
		expect(parseMetricLines('calls | Phone calls\nrevenue | Revenue | sum | money\n\nrating | Avg rating | avg | decimal')).toEqual([
			{ metric: 'calls', label: 'Phone calls', agg: 'sum', format: null },
			{ metric: 'revenue', label: 'Revenue', agg: 'sum', format: 'money' },
			{ metric: 'rating', label: 'Avg rating', agg: 'avg', format: 'decimal' }
		]);
	});
	it('explains bad lines', () => {
		expect(() => parseMetricLines('Bad Key | x')).toThrow(/Line 1/);
		expect(() => parseMetricLines('calls')).toThrow(/label/);
	});
});
