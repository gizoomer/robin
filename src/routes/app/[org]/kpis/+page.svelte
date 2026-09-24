<script lang="ts">
	import { enhance } from '$app/forms';
	import SetupTabs from '$lib/components/SetupTabs.svelte';
	import { METRICS, SOURCES, type SourceId } from '$lib/metrics';

	let { data, form } = $props();

	const key = (s: string, m: string) => `${s}:${m}`;
	// svelte-ignore state_referenced_locally
	let selected = $state(new Set(data.kpis.map((k) => key(k.source, k.metric))));
	let targets = $derived(Object.fromEntries(data.kpis.map((k) => [key(k.source, k.metric), k.monthly_target])));
	let groups = $derived(
		(Object.keys(SOURCES) as SourceId[]).map((s) => ({
			source: s,
			label: SOURCES[s].label,
			connected: data.connected.includes(SOURCES[s].provider),
			metrics: METRICS.filter((m) => m.source === s)
		}))
	);

	function toggle(k: string, on: boolean) {
		const next = new Set(selected);
		if (on) next.add(k);
		else next.delete(k);
		selected = next;
	}
</script>

<SetupTabs slug={data.org.slug} />

<p class="max-w-2xl text-sm text-ink-2">
	Pick up to {data.max} headline KPIs. They appear at the top of {data.org.name}'s dashboard with progress toward the monthly goal,
	and roll up into your all-clients view. Everything else still shows further down the dashboard.
</p>

<form method="POST" use:enhance={() => async ({ update }) => update({ reset: false })} class="mt-4 space-y-4">
	{#each groups as g (g.source)}
		<section class="card p-4 {g.connected ? '' : 'opacity-60'}">
			<h2 class="font-semibold">{g.label} {#if !g.connected}<span class="text-xs font-normal text-ink-3">not connected yet</span>{/if}</h2>
			<ul class="mt-2 divide-y divide-line">
				{#each g.metrics as m (m.metric)}
					{@const k = key(m.source, m.metric)}
					<li class="flex flex-wrap items-center gap-3 py-2">
						<label class="flex min-h-11 flex-1 cursor-pointer items-center gap-3">
							<input type="checkbox" name="kpi" value={k} checked={selected.has(k)} onchange={(e) => toggle(k, e.currentTarget.checked)} class="size-5 accent-[var(--accent)]" />
							<span>{m.label}</span>
						</label>
						{#if selected.has(k)}
							<label class="flex items-center gap-2 text-sm text-ink-2">
								{m.upIsGood === false ? 'Goal (at or below)' : 'Monthly goal'}
								<input class="input w-32" name="target:{k}" inputmode="decimal" placeholder="optional" value={targets[k] ?? ''} />
							</label>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/each}

	<div class="sticky bottom-16 flex items-center gap-3 rounded-xl border border-line bg-surface p-3 sm:bottom-2">
		<span class="text-sm {selected.size > data.max ? 'text-bad' : 'text-ink-2'}">{selected.size} of {data.max} selected</span>
		{#if form?.error}<span class="text-sm text-bad">{form.error}</span>{/if}
		{#if form && 'saved' in form}<span class="text-sm text-good" role="status">Saved</span>{/if}
		<button class="btn-primary ml-auto" disabled={selected.size > data.max}>Save KPIs</button>
	</div>
</form>
