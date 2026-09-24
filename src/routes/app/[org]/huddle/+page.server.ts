import { fail } from '@sveltejs/kit';
import { orgFromEvent } from '$lib/server/org';

export async function load({ locals, parent }) {
	const { org } = await parent();
	const { data } = await locals.supabase
		.from('huddle_notes')
		.select('id, huddle_date, wins, blockers, focus, author_id')
		.eq('org_id', org.id)
		.order('huddle_date', { ascending: false })
		.order('created_at', { ascending: false })
		.limit(30);
	return { notes: data ?? [] };
}

export const actions = {
	default: async (event) => {
		const { org, userId, canWork } = await orgFromEvent(event);
		if (!canWork) return fail(403, { error: 'View-only accounts cannot post huddles' });
		const f = await event.request.formData();
		const note = {
			wins: String(f.get('wins') ?? '').trim() || null,
			blockers: String(f.get('blockers') ?? '').trim() || null,
			focus: String(f.get('focus') ?? '').trim() || null
		};
		if (!note.wins && !note.blockers && !note.focus) return fail(400, { error: 'Write at least one line' });
		const { error } = await event.locals.supabase.from('huddle_notes').insert({ org_id: org.id, author_id: userId, ...note });
		if (error) return fail(400, { error: error.message });
		return { ok: true };
	}
};
