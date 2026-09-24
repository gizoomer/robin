<script lang="ts">
	let { slug, clientName, providers }: { slug: string; clientName: string; providers: ('claude' | 'chatgpt')[] } = $props();

	const LABEL = { claude: 'Claude', chatgpt: 'ChatGPT' } as const;
	const SUGGESTED = [
		'What should we focus on this month?',
		'Why did website visits change?',
		'Is our ad spend paying off?',
		'Which rep needs coaching, and on what?'
	];

	let open = $state(false);
	// svelte-ignore state_referenced_locally
	let provider = $state(providers[0] ?? 'claude');
	let question = $state('');
	let turns = $state<{ role: 'user' | 'assistant'; content: string }[]>([]);
	let busy = $state(false);
	let err = $state<string | null>(null);

	async function ask(q = question) {
		q = q.trim();
		if (!q || busy) return;
		busy = true;
		err = null;
		const history = turns.slice();
		turns = [...turns, { role: 'user', content: q }];
		question = '';
		try {
			const res = await fetch(`/app/${slug}/ask`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ provider, question: q, history })
			});
			const j = await res.json();
			if (!res.ok) throw new Error(j.message ?? 'Something went wrong');
			turns = [...turns, { role: 'assistant', content: j.answer }];
		} catch (e) {
			err = (e as Error).message;
			turns = turns.slice(0, -1);
			question = q;
		} finally {
			busy = false;
		}
	}
</script>

{#if providers.length}
	<button class="btn-primary fixed bottom-20 right-4 z-30 shadow-lg sm:bottom-6" onclick={() => (open = !open)} aria-expanded={open}>
		{open ? 'Close' : 'Ask about this report'}
	</button>

	{#if open}
		<section class="card fixed bottom-36 right-4 z-30 flex max-h-[70vh] w-[min(420px,calc(100vw-32px))] flex-col shadow-xl sm:bottom-20" aria-label="Ask about this report">
			<header class="flex items-center justify-between gap-2 border-b border-line p-3">
				<div>
					<p class="font-semibold">Ask about {clientName}</p>
					<p class="text-xs text-ink-3">Answers use this dashboard's last 30 days.</p>
				</div>
				{#if providers.length > 1}
					<div class="flex rounded-lg border border-line p-0.5 text-xs" role="radiogroup" aria-label="AI provider">
						{#each providers as p (p)}
							<button role="radio" aria-checked={provider === p} class="rounded-md px-2 py-1 {provider === p ? 'bg-ink text-bg font-semibold' : 'text-ink-2'}" onclick={() => (provider = p)}>{LABEL[p]}</button>
						{/each}
					</div>
				{/if}
			</header>

			<div class="flex-1 space-y-3 overflow-y-auto p-3 text-sm" aria-live="polite">
				{#if turns.length === 0}
					<p class="text-ink-2">Ask a question or pick one:</p>
					<div class="flex flex-wrap gap-2">
						{#each SUGGESTED as s (s)}
							<button class="rounded-full border border-line px-3 py-1.5 text-left text-xs hover:border-accent" onclick={() => ask(s)}>{s}</button>
						{/each}
					</div>
				{/if}
				{#each turns as t, i (i)}
					<div class={t.role === 'user' ? 'ml-8 rounded-lg bg-accent/10 p-2' : 'mr-4 whitespace-pre-wrap'}>{t.content}</div>
				{/each}
				{#if busy}<p class="text-ink-3">{LABEL[provider]} is thinking…</p>{/if}
				{#if err}<p class="text-bad">{err}</p>{/if}
			</div>

			<form class="flex gap-2 border-t border-line p-3" onsubmit={(e) => { e.preventDefault(); ask(); }}>
				<label class="sr-only" for="ask-q">Your question</label>
				<input id="ask-q" class="input" bind:value={question} placeholder="Ask a question" autocomplete="off" />
				<button class="btn-primary" disabled={busy || !question.trim()}>Ask</button>
			</form>
			<p class="px-3 pb-2 text-[11px] text-ink-3">AI can be wrong. Check important numbers against the dashboard.</p>
		</section>
	{/if}
{/if}
