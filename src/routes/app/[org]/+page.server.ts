import { configuredProviders } from '$lib/server/ai';
import { isDemo } from '$lib/server/demo';
import { loadOverview } from '$lib/server/overview';

export async function load({ locals, parent }) {
	const { org } = await parent();
	const [overview, { data: settings }] = await Promise.all([
		loadOverview(locals.supabase, org),
		locals.supabase.from('organizations').select('ai_enabled').eq('id', org.id).single()
	]);
	const aiProviders = settings?.ai_enabled === false ? [] : isDemo() ? (['claude', 'chatgpt'] as const) : configuredProviders();
	return { ...overview, aiProviders: [...aiProviders] };
}
