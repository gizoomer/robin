import { loadOrg } from '$lib/server/org';

export async function load({ params, locals }) {
	const { user } = await locals.safeGetSession();
	return { ...(await loadOrg(locals.supabase, params.org, user!.id)), userId: user!.id };
}
