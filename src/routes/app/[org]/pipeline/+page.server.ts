import { fail } from '@sveltejs/kit';
import { orgFromEvent } from '$lib/server/org';
import { LEAD_STAGES, QUICK_ACTIVITIES } from '$lib/metrics';

const STAGE_IDS = LEAD_STAGES.map((s) => s.id) as string[];
const ACTIVITY_IDS = QUICK_ACTIVITIES.map((a) => a.id) as string[];

export async function load({ locals, parent }) {
	const { org } = await parent();
	// Closed deals drop off the board after 30 days to keep it fast on phones.
	const closedSince = new Date(Date.now() - 30 * 86400_000).toISOString();
	const { data: leads } = await locals.supabase
		.from('leads')
		.select('id, name, company, phone, source, stage, estimated_value, owner_id, stage_changed_at')
		.eq('org_id', org.id)
		.or(`stage.not.in.(closed_won,closed_lost),stage_changed_at.gte.${closedSince}`)
		.order('stage_changed_at', { ascending: false })
		.limit(500);

	const ownerIds = [...new Set((leads ?? []).map((l) => l.owner_id).filter(Boolean))] as string[];
	const { data: owners } = ownerIds.length
		? await locals.supabase.from('profiles').select('id, full_name').in('id', ownerIds)
		: { data: [] };

	return {
		leads: leads ?? [],
		owners: Object.fromEntries((owners ?? []).map((o) => [o.id, o.full_name ?? '']))
	};
}

export const actions = {
	move: async (event) => {
		const { request, locals } = event;
		const { org, userId } = await orgFromEvent(event);
		const f = await request.formData();
		const id = String(f.get('id'));
		const stage = String(f.get('stage'));
		if (!STAGE_IDS.includes(stage)) return fail(400, { error: 'Unknown stage' });

		const { data, error } = await locals.supabase.from('leads').update({ stage }).eq('id', id).eq('org_id', org.id).select('id');
		if (error || !data?.length) return fail(403, { error: 'You can only move leads assigned to you' });
		await locals.supabase.from('activities').insert({ org_id: org.id, lead_id: id, user_id: userId, type: 'stage_change', notes: stage });
		return { ok: true };
	},

	log: async (event) => {
		const { request, locals } = event;
		const { org, userId } = await orgFromEvent(event);
		const f = await request.formData();
		const type = String(f.get('type'));
		if (!ACTIVITY_IDS.includes(type)) return fail(400, { error: 'Unknown activity' });
		const leadId = String(f.get('id'));
		const { error } = await locals.supabase
			.from('activities')
			.insert({ org_id: org.id, lead_id: leadId, user_id: userId, type, notes: String(f.get('notes') ?? '') || null });
		if (error) return fail(403, { error: 'Could not log activity' });

		// Logging first contact on a brand new lead advances it automatically.
		await locals.supabase.from('leads').update({ stage: 'attempted_contact' }).eq('id', leadId).eq('org_id', org.id).eq('stage', 'new');
		return { ok: true, logged: type };
	}
};
