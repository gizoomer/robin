import { error, json } from '@sveltejs/kit';
import { SOURCES } from '$lib/metrics';
import { askAi, buildContext, configuredProviders, systemPrompt, type AiProvider, type ChatTurn } from '$lib/server/ai';
import { isDemo } from '$lib/server/demo';
import { orgFromEvent } from '$lib/server/org';
import { loadOverview } from '$lib/server/overview';

/** POST { provider, question, history } → { answer }. Any member of the client can ask. */
export async function POST(event) {
	const { org } = await orgFromEvent(event);
	const { data: settings } = await event.locals.supabase.from('organizations').select('ai_enabled, industry').eq('id', org.id).single();
	if (settings && settings.ai_enabled === false) error(403, 'The AI assistant is switched off for this account.');

	const body = await event.request.json().catch(() => null);
	const provider = body?.provider as AiProvider;
	const question = String(body?.question ?? '').trim().slice(0, 2000);
	const history: ChatTurn[] = (Array.isArray(body?.history) ? body.history : [])
		.filter((t: ChatTurn) => (t?.role === 'user' || t?.role === 'assistant') && typeof t.content === 'string')
		.map((t: ChatTurn) => ({ role: t.role, content: t.content.slice(0, 4000) }));
	if (!question) error(400, 'Type a question');

	// Same numbers the dashboard shows, read with the asker's own permissions.
	const overview = await loadOverview(event.locals.supabase, org);
	const labels = { ...Object.fromEntries(Object.entries(SOURCES).map(([k, v]) => [k, v.label])), ...overview.appSources };
	const context = buildContext({ name: org.name, industry: settings?.industry }, overview, labels);

	if (isDemo()) {
		return json({ answer: `Demo mode: no AI provider is called. In the live app, ${provider === 'chatgpt' ? 'ChatGPT' : 'Claude'} would answer "${question}" using this data:\n\n${context}` });
	}
	if (!configuredProviders().includes(provider)) error(400, `${provider === 'chatgpt' ? 'ChatGPT' : 'Claude'} is not set up yet. Add its API key in the server settings.`);
	try {
		return json({ answer: await askAi(provider, systemPrompt(org.name), context, history, question) });
	} catch (e) {
		error(502, `The AI provider didn't answer: ${(e as Error).message}`);
	}
}
