import { createServerClient } from '@supabase/ssr';
import { redirect, type Handle } from '@sveltejs/kit';
import { env as publicEnv } from '$env/dynamic/public';
import { DEMO_COOKIE, demoClient, demoUserExists, isDemo } from '$lib/server/demo';

export const handle: Handle = async ({ event, resolve }) => {
	const demoUser = event.cookies.get(DEMO_COOKIE);
	event.locals.supabase = isDemo()
		? demoClient(demoUser && demoUserExists(demoUser) ? demoUser : null)
		: createServerClient(publicEnv.PUBLIC_SUPABASE_URL!, publicEnv.PUBLIC_SUPABASE_ANON_KEY!, {
			cookies: {
				getAll: () => event.cookies.getAll(),
				setAll: (cookies) => {
					for (const { name, value, options } of cookies) {
						event.cookies.set(name, value, { ...options, path: '/' });
					}
				}
			}
		});

	// getSession() alone trusts the cookie; getUser() verifies the JWT with Supabase.
	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		if (!session) return { session: null, user: null };
		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error) return { session: null, user: null };
		return { session, user };
	};

	if (event.url.pathname.startsWith('/app')) {
		const { user } = await event.locals.safeGetSession();
		if (!user) redirect(303, isDemo() ? '/demo' : `/login?next=${encodeURIComponent(event.url.pathname)}`);
	}

	return resolve(event, {
		filterSerializedResponseHeaders: (name) => name === 'content-range' || name === 'x-supabase-api-version'
	});
};
