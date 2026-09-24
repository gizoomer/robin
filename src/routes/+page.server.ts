import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
	const { user } = await locals.safeGetSession();
	redirect(303, user ? '/app' : '/login');
}
