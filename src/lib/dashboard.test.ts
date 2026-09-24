import { describe, expect, it } from 'vitest';
import { buildTiles, pipelineStats } from './dashboard';

const today = new Date('2026-09-24T12:00:00Z');
const day = (offset: number) => {
	const d = new Date('2026-09-24T00:00:00Z');
	d.setUTCDate(d.getUTCDate() - offset);
	return d.toISOString().slice(0, 10);
};

describe('buildTiles', () => {
	it('sums flows and compares to the prior window', () => {
		const rows = [
			...Array.from({ length: 30 }, (_, i) => ({ source: 'ga4', metric: 'sessions', day: day(i + 1), value: 10 })),
			...Array.from({ length: 30 }, (_, i) => ({ source: 'ga4', metric: 'sessions', day: day(i + 31), value: 5 }))
		];
		const t = buildTiles(rows, 30, today).ga4.find((x) => x.def.metric === 'sessions')!;
		expect(t.value).toBe(300);
		expect(t.prior).toBe(150);
		expect(t.delta).toBeCloseTo(1);
		expect(t.spark).toHaveLength(30);
	});

	it('uses the latest value for stock metrics like followers', () => {
		const rows = [
			{ source: 'instagram', metric: 'followers', day: day(5), value: 900 },
			{ source: 'instagram', metric: 'followers', day: day(1), value: 1000 }
		];
		const t = buildTiles(rows, 30, today).instagram.find((x) => x.def.metric === 'followers')!;
		expect(t.value).toBe(1000);
		expect(t.delta).toBeNull();
	});

	it('omits metrics with no data', () => {
		expect(buildTiles([], 30, today).youtube).toEqual([]);
	});
});

describe('pipelineStats', () => {
	it('computes open value and win rate', () => {
		const base = { owner_id: 'a', created_at: '', stage_changed_at: '' };
		const s = pipelineStats([
			{ ...base, stage: 'new', estimated_value: 100 },
			{ ...base, stage: 'proposal_sent', estimated_value: 200 },
			{ ...base, stage: 'closed_won', estimated_value: 500 },
			{ ...base, stage: 'closed_lost', estimated_value: 50 }
		]);
		expect(s.openValue).toBe(300);
		expect(s.wonValue).toBe(500);
		expect(s.winRate).toBe(0.5);
	});
});
