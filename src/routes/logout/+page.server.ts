import { redirect } from '@sveltejs/kit';
import { DEMO_COOKIE, isDemo } from '$lib/server/demo';

export const actions = {
	default: async ({ locals, cookies }) => {
		await locals.supabase.auth.signOut();
		if (isDemo()) {
			cookies.delete(DEMO_COOKIE, { path: '/' });
			redirect(303, '/demo');
		}
		redirect(303, '/login');
	}
};
