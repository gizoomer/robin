import { isDemo } from '$lib/server/demo';

export async function load({ locals }) {
	const { session, user } = await locals.safeGetSession();
	let demo: { name: string } | null = null;
	if (isDemo()) {
		const { data } = user ? await locals.supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle() : { data: null };
		demo = { name: data?.full_name ?? '' };
	}
	return { session, demo };
}
