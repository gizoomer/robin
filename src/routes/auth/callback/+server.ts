import { redirect } from '@sveltejs/kit';

export async function GET({ url, locals }) {
	const code = url.searchParams.get('code');
	const next = url.searchParams.get('next') ?? '/app';
	if (code) await locals.supabase.auth.exchangeCodeForSession(code);
	// Only allow same-site relative redirects.
	redirect(303, next.startsWith('/') && !next.startsWith('//') ? next : '/app');
}
