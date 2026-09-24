import { createClient } from '@supabase/supabase-js';
import { env as publicEnv } from '$env/dynamic/public';
import { env } from '$env/dynamic/private';
import { demoClient, isDemo } from './demo';

/** Service-role client. Bypasses RLS: only use for token storage and the sync job. */
export function supabaseAdmin() {
	if (isDemo()) return demoClient();
	if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
	return createClient(publicEnv.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY, {
		auth: { persistSession: false, autoRefreshToken: false }
	});
}
