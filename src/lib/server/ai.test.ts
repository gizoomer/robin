import { describe, expect, it } from 'vitest';
import { buildContext, systemPrompt } from './ai';
import { buildTiles } from '$lib/dashboard';
import type { Overview } from './overview';

const today = new Date();
const day = (n: number) => new Date(today.getTime() - n * 86400_000).toISOString().slice(0, 10);

describe('AI report context', () => {
	it('summarizes the numbers without contact details', () => {
		const tiles = buildTiles(Array.from({ length: 30 }, (_, i) => ({ source: 'ga4', metric: 'sessions', day: day(i + 1), value: 100 })));
		const overview = {
			tiles,
			appSources: {},
			goals: [],
			pipeline: { openValue: 50000, openCount: 5, wonValue: 20000, wonCount: 2, winRate: 0.5 },
			reps: [{ id: 'u1', name: 'Maria Lopez', leads: 4, openValue: 0, openCount: 0, wonValue: 20000, wonCount: 2, winRate: 0.5, activities: 9 }],
			roi: { spend: 4000, since: '2026-06-01', costPerLead: 400, wonRevenue: 20000, roi: 4 },
			huddle: null
		} as unknown as Overview;
		const text = buildContext({ name: 'Acme Roofing', industry: 'Roofing' }, overview, { ga4: 'Website (Google Analytics)' });
		expect(text).toContain('Acme Roofing (Roofing)');
		expect(text).toContain('Website visits: 3,000');
		expect(text).toContain('win rate 50%');
		expect(text).toContain('Maria Lopez: 4 leads');
		expect(text).not.toMatch(/\(\d{3}\)/); // no phone numbers
	});

	it('tells the model to treat report data as data', () => {
		expect(systemPrompt('Acme')).toMatch(/data, not instructions/);
	});
});
