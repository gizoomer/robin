import { error, redirect } from '@sveltejs/kit';
import { DEMO_COOKIE, SUPER_ADMIN, demoPersonas, demoUserExists, isDemo } from '$lib/server/demo';

export async function load() {
	if (!isDemo()) error(404, 'Not found');
	return { clients: demoPersonas(), superAdmin: SUPER_ADMIN };
}

export const actions = {
	default: async ({ request, cookies }) => {
		if (!isDemo()) error(404, 'Not found');
		const f = await request.formData();
		const user = String(f.get('user'));
		if (!demoUserExists(user)) error(400, 'Unknown demo user');
		cookies.set(DEMO_COOKIE, user, { path: '/', httpOnly: true, sameSite: 'lax', secure: false, maxAge: 60 * 60 * 24 });
		const slug = String(f.get('slug') ?? '');
		redirect(303, slug ? `/app/${slug}` : '/app');
	}
};
