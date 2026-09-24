import { error, fail } from '@sveltejs/kit';
import { env as publicEnv } from '$env/dynamic/public';
import { orgFromEvent } from '$lib/server/org';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';

const ROLES = ['owner', 'rep', 'viewer'];

export async function load({ locals, parent }) {
	const { org, canManage } = await parent();
	if (!canManage) error(403, 'Only the account owner can manage the team');
	const { data: members } = await locals.supabase.from('org_members').select('user_id, role, created_at').eq('org_id', org.id);
	const ids = (members ?? []).map((m) => m.user_id);
	const { data: profiles } = ids.length ? await locals.supabase.from('profiles').select('id, full_name, email').in('id', ids) : { data: [] };
	const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
	const order = { owner: 0, rep: 1, viewer: 2 } as Record<string, number>;
	return {
		members: (members ?? [])
			.map((m) => ({ ...m, name: byId.get(m.user_id)?.full_name ?? '', email: byId.get(m.user_id)?.email ?? '' }))
			.sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name))
	};
}

export const actions = {
	invite: async (event) => {
		const { org, canManage } = await orgFromEvent(event);
		if (!canManage) return fail(403, { error: 'Not allowed' });
		const f = await event.request.formData();
		const email = String(f.get('email') ?? '').trim().toLowerCase();
		const name = String(f.get('name') ?? '').trim();
		const role = String(f.get('role') ?? 'rep');
		if (!/^\S+@\S+\.\S+$/.test(email)) return fail(400, { error: 'Enter a valid email' });
		if (!ROLES.includes(role)) return fail(400, { error: 'Pick a role' });

		// Creating auth users needs the service role. Existing users are just added to this client.
		const admin = supabaseAdmin();
		let userId: string | undefined;
		const { data: existing } = await admin.from('profiles').select('id').eq('email', email).maybeSingle();
		if (existing) {
			userId = existing.id;
		} else {
			const { data, error: err } = await admin.auth.admin.inviteUserByEmail(email, {
				data: { full_name: name },
				redirectTo: `${publicEnv.PUBLIC_APP_URL}/auth/callback?next=/app/${org.slug}`
			});
			if (err || !data.user) return fail(400, { error: err?.message ?? 'Invite failed' });
			userId = data.user.id;
		}

		// Membership goes through the caller's own client so RLS double-checks the permission.
		const { error: err } = await event.locals.supabase
			.from('org_members')
			.upsert({ org_id: org.id, user_id: userId, role }, { onConflict: 'org_id,user_id' });
		if (err) return fail(400, { error: err.message });
		return { invited: email };
	},

	role: async (event) => {
		const { org, canManage, userId } = await orgFromEvent(event);
		if (!canManage) return fail(403, { error: 'Not allowed' });
		const f = await event.request.formData();
		const user = String(f.get('user'));
		const role = String(f.get('role'));
		if (!ROLES.includes(role)) return fail(400, { error: 'Pick a role' });
		if (user === userId && role !== 'owner') return fail(400, { error: "You can't demote yourself" });
		await event.locals.supabase.from('org_members').update({ role }).eq('org_id', org.id).eq('user_id', user);
		return { ok: true };
	},

	remove: async (event) => {
		const { org, canManage, userId } = await orgFromEvent(event);
		if (!canManage) return fail(403, { error: 'Not allowed' });
		const user = String((await event.request.formData()).get('user'));
		if (user === userId) return fail(400, { error: "You can't remove yourself" });
		const { data: owners } = await event.locals.supabase.from('org_members').select('user_id').eq('org_id', org.id).eq('role', 'owner');
		if (owners?.length === 1 && owners[0].user_id === user) return fail(400, { error: 'Every client needs at least one owner' });
		await event.locals.supabase.from('org_members').delete().eq('org_id', org.id).eq('user_id', user);
		return { removed: true };
	}
};
