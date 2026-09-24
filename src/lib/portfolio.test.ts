import { describe, expect, it } from 'vitest';
import { summarizeClient } from './portfolio';

const today = new Date('2026-09-24T12:00:00Z');
const day = (offset: number) => new Date(today.getTime() - offset * 86400_000).toISOString().slice(0, 10);
const org = { id: 'o1', name: 'Acme', slug: 'acme' };

describe('summarizeClient', () => {
	it('flags broken connections and missed KPIs', () => {
		const snapshots = Array.from({ length: 30 }, (_, i) => ({ source: 'ga4', metric: 'sessions', day: day(i + 1), value: 10 }));
		const s = summarizeClient({
			org,
			members: 3,
			leads: [],
			snapshots,
			kpis: [{ source: 'ga4', metric: 'sessions', position: 0, monthly_target: 600 }],
			integrations: [{ provider: 'meta', status: 'error' }, { provider: 'google', status: 'connected' }],
			today
		});
		expect(s.sessions).toBe(300);
		expect(s.kpiAttainment).toBeCloseTo(0.5);
		expect(s.alerts).toEqual(['meta needs reconnecting', 'KPIs at 50% of goal']);
		expect(s.connected).toBe(1);
	});

	it('treats lower search position as better when scoring KPIs', () => {
		const snapshots = Array.from({ length: 30 }, (_, i) => ({ source: 'gsc', metric: 'position', day: day(i + 1), value: 8 }));
		const s = summarizeClient({
			org, members: 1, leads: [], snapshots,
			kpis: [{ source: 'gsc', metric: 'position', position: 0, monthly_target: 10 }],
			integrations: [{ provider: 'google', status: 'connected' }],
			today
		});
		expect(s.kpiAttainment).toBeCloseTo(1.25);
		expect(s.alerts).toEqual([]);
	});

	it('sums ad spend across platforms', () => {
		const snapshots = [
			{ source: 'google_ads', metric: 'spend', day: day(2), value: 100 },
			{ source: 'meta_ads', metric: 'spend', day: day(3), value: 50 }
		];
		const s = summarizeClient({ org, members: 1, leads: [], snapshots, kpis: [], integrations: [{ provider: 'google_ads', status: 'connected' }], today });
		expect(s.adSpend30).toBe(150);
	});
});
