import { error } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

export type Role = 'owner' | 'rep' | 'viewer' | 'agency';

/** Loads an org by slug through RLS and works out the caller's role in it. */
export async function loadOrg(supabase: SupabaseClient, slug: string, userId: string) {
	const { data: org } = await supabase.from('organizations').select('id, name, slug, logo_url').eq('slug', slug).maybeSingle();
	if (!org) error(404, 'Client not found');

	const [{ data: member }, { data: profile }] = await Promise.all([
		supabase.from('org_members').select('role').eq('org_id', org.id).eq('user_id', userId).maybeSingle(),
		supabase.from('profiles').select('is_agency_staff').eq('id', userId).single()
	]);
	const role: Role = profile?.is_agency_staff ? 'agency' : (member?.role ?? 'viewer');
	return {
		org,
		role,
		canWork: role !== 'viewer',
		canManage: role === 'owner' || role === 'agency'
	};
}

/** For form actions, which cannot call parent(). */
export async function orgFromEvent(event: { params: Record<string, string>; locals: App.Locals }) {
	const { user } = await event.locals.safeGetSession();
	if (!user) error(401, 'Sign in required');
	return { ...(await loadOrg(event.locals.supabase, event.params.org, user.id)), userId: user.id };
}
