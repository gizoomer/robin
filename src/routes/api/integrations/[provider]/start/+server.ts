import { error, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { connectors, isProvider } from '$lib/server/connectors';
import { signState } from '$lib/server/crypto';
import { loadOrg } from '$lib/server/org';

export async function GET({ params, url, locals }) {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');
	if (!isProvider(params.provider)) error(404, 'Unknown provider');
	const connector = connectors[params.provider];
	if (!connector.authorizeUrl) error(400, 'This platform connects with an API key on the Connections page.');

	const slug = url.searchParams.get('org') ?? '';
	const { org, canManage } = await loadOrg(locals.supabase, slug, user.id);
	if (!canManage) error(403, 'Only the account owner can connect platforms');

	const state = signState({ org: org.id, slug: org.slug, user: user.id }, env.TOKEN_ENCRYPTION_KEY);
	const redirectUri = `${publicEnv.PUBLIC_APP_URL}/api/integrations/${params.provider}/callback`;
	redirect(302, connector.authorizeUrl(state, redirectUri));
}
