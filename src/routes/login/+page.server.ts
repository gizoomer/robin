import { fail, redirect } from '@sveltejs/kit';
import { env as publicEnv } from '$env/dynamic/public';
import { isDemo } from '$lib/server/demo';

/** Only same-site relative paths, so `next` can't bounce people to another site. */
function safeNext(url: URL) {
	const next = url.searchParams.get('next') ?? '/app';
	return next.startsWith('/') && !next.startsWith('//') ? next : '/app';
}

// Supabase provider ids. "azure" = Microsoft (work, school and personal accounts).
const PROVIDERS = { google: 'google', microsoft: 'azure' } as const;

export async function load({ locals }) {
	if (isDemo()) redirect(303, '/demo');
	const { user } = await locals.safeGetSession();
	if (user) redirect(303, '/app');
}

export const actions = {
	email: async ({ request, locals, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		if (!/^\S+@\S+\.\S+$/.test(email)) return fail(400, { email, error: 'Enter a valid email' });

		const { error } = await locals.supabase.auth.signInWithOtp({
			email,
			options: {
				shouldCreateUser: false, // clients are invited, not self-signup
				emailRedirectTo: `${publicEnv.PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(safeNext(url))}`
			}
		});
		if (error) return fail(400, { email, error: 'We could not find an account for that email. Ask your MYCMO contact for an invite.' });
		return { sent: true, email };
	},

	/**
	 * Google / Microsoft sign-in. This only proves who the person is (email + name).
	 * It does NOT grant access to their Analytics or ad accounts; that is a separate,
	 * explicit step on Setup > Connections. Access to client data still comes only from
	 * org_members, so an uninvited person who signs in sees nothing.
	 */
	oauth: async ({ request, locals, url }) => {
		const key = String((await request.formData()).get('provider')) as keyof typeof PROVIDERS;
		const provider = PROVIDERS[key];
		if (!provider) return fail(400, { error: 'Unknown sign-in option' });

		const { data, error } = await locals.supabase.auth.signInWithOAuth({
			provider,
			options: {
				redirectTo: `${publicEnv.PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(safeNext(url))}`,
				// Microsoft only returns the email address when asked for it explicitly.
				scopes: provider === 'azure' ? 'email openid profile' : undefined
			}
		});
		if (error || !data.url) return fail(400, { error: `${key === 'google' ? 'Google' : 'Microsoft'} sign-in is not set up yet.` });
		redirect(303, data.url);
	}
};
