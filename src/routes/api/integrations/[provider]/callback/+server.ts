import { error, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { connectors, isProvider } from '$lib/server/connectors';
import { verifyState } from '$lib/server/crypto';
import { saveTokens } from '$lib/server/integrations';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';

export async function GET({ params, url, locals }) {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');
	if (!isProvider(params.provider)) error(404, 'Unknown provider');

	const state = verifyState(url.searchParams.get('state') ?? '', env.TOKEN_ENCRYPTION_KEY);
	if (!state || state.user !== user.id) error(400, 'This connection link expired. Please try again.');

	const back = `/app/${state.slug}/integrations`;
	const code = url.searchParams.get('code');
	if (!code) redirect(303, `${back}?error=${encodeURIComponent(url.searchParams.get('error_description') ?? 'Cancelled')}`);

	// Re-check permission through RLS: only owners/agency may write integrations.
	const { data: integ, error: upsertErr } = await locals.supabase
		.from('integrations')
		.upsert(
			{ org_id: state.org, provider: params.provider, status: 'pending_setup', connected_by: user.id, last_error: null },
			{ onConflict: 'org_id,provider' }
		)
		.select('id')
		.single();
	if (upsertErr || !integ) error(403, 'You do not have permission to connect accounts for this client');

	const redirectUri = `${publicEnv.PUBLIC_APP_URL}/api/integrations/${params.provider}/callback`;
	const tokens = await connectors[params.provider].exchangeCode(code, redirectUri);
	await saveTokens(supabaseAdmin(), integ.id, tokens);

	redirect(303, `${back}?connected=${params.provider}`);
}
