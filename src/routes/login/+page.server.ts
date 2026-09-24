import { fail, redirect } from '@sveltejs/kit';
import { env as publicEnv } from '$env/dynamic/public';
import { isDemo } from '$lib/server/demo';

export async function load({ locals }) {
	if (isDemo()) redirect(303, '/demo');
	const { user } = await locals.safeGetSession();
	if (user) redirect(303, '/app');
}

export const actions = {
	default: async ({ request, locals, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		if (!/^\S+@\S+\.\S+$/.test(email)) return fail(400, { email, error: 'Enter a valid email' });

		const next = url.searchParams.get('next') ?? '/app';
		const { error } = await locals.supabase.auth.signInWithOtp({
			email,
			options: {
				shouldCreateUser: false, // clients are invited, not self-signup
				emailRedirectTo: `${publicEnv.PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(next)}`
			}
		});
		if (error) return fail(400, { email, error: 'We could not find an account for that email.' });
		return { sent: true, email };
	}
};
