import { describe, expect, it } from 'vitest';
import { rollUpLeads } from './whatconverts';

describe('WhatConverts roll-up', () => {
	it('counts leads by day and type and sums sales value', () => {
		const rows = rollUpLeads([
			{ date_created: '2026-09-01T14:02:00Z', lead_type: 'Phone Call', quotable: 'Yes', sales_value: '1,200' },
			{ date_created: '2026-09-01 09:10:00', lead_type: 'Web Form', quotable: 'No', sales_value: null },
			{ date_created: '2026-09-02T10:00:00Z', lead_type: 'Chat', quotable: true, sales_value: 300 },
			{ date_created: 'garbage', lead_type: 'Phone Call' }
		]);
		const get = (day: string, metric: string) => rows.find((r) => r.day === day && r.metric === metric)?.value;
		expect(get('2026-09-01', 'leads')).toBe(2);
		expect(get('2026-09-01', 'calls')).toBe(1);
		expect(get('2026-09-01', 'forms')).toBe(1);
		expect(get('2026-09-01', 'quotable')).toBe(1);
		expect(get('2026-09-01', 'sales_value')).toBe(1200);
		expect(get('2026-09-02', 'quotable')).toBe(1);
		expect(rows.every((r) => r.source === 'whatconverts')).toBe(true);
	});
});
