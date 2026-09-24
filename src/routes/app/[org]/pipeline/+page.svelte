<script lang="ts">
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { LEAD_STAGES, QUICK_ACTIVITIES, money } from '$lib/metrics';

	let { data } = $props();

	// Optimistic stage overrides, cleared once the server data reloads.
	let pending = $state<Record<string, string>>({});
	let dragging = $state<string | null>(null);
	let dropTarget = $state<string | null>(null);
	let openLead = $state<string | null>(null);
	let toast = $state<string | null>(null);

	let columns = $derived(
		LEAD_STAGES.map((s) => {
			const items = data.leads.filter((l) => (pending[l.id] ?? l.stage) === s.id);
			return { ...s, items, total: items.reduce((a, l) => a + Number(l.estimated_value), 0) };
		})
	);

	async function post(action: string, body: Record<string, string>) {
		const fd = new FormData();
		for (const [k, v] of Object.entries(body)) fd.set(k, v);
		const res = await fetch(`?/${action}`, { method: 'POST', body: fd, headers: { 'x-sveltekit-action': 'true' } });
		const result = deserialize(await res.text());
		if (result.type === 'failure') flash(String(result.data?.error ?? 'Something went wrong'));
		return result;
	}

	function flash(msg: string) {
		toast = msg;
		setTimeout(() => (toast = null), 2500);
	}

	async function move(id: string, stage: string) {
		pending[id] = stage;
		await post('move', { id, stage });
		await invalidateAll();
		delete pending[id];
	}

	async function log(id: string, type: string, label: string) {
		const r = await post('log', { id, type });
		if (r.type === 'success') flash(`${label} ✓`);
		await invalidateAll();
	}
</script>

<div class="mb-4 flex items-center justify-between">
	<h1 class="text-xl font-semibold">Pipeline</h1>
	{#if data.canWork}<a href="/app/{data.org.slug}/leads/new" class="btn-primary">+ Lead</a>{/if}
</div>

<div class="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4">
	{#each columns as col (col.id)}
		<section
			class="card flex w-[85vw] max-w-xs shrink-0 snap-start flex-col sm:w-72 {dropTarget === col.id ? 'border-accent' : ''}"
			aria-label={col.label}
			ondragover={(e) => {
				if (!dragging) return;
				e.preventDefault();
				dropTarget = col.id;
			}}
			ondragleave={() => (dropTarget = null)}
			ondrop={(e) => {
				e.preventDefault();
				if (dragging) move(dragging, col.id);
				dragging = dropTarget = null;
			}}
		>
			<header class="border-b border-line p-3">
				<h2 class="text-sm font-semibold">{col.label} <span class="font-normal text-ink-3">{col.items.length}</span></h2>
				<p class="text-xs text-ink-2 tabular-nums">{money.format(col.total)}</p>
			</header>
			<ul class="flex min-h-24 flex-col gap-2 p-2">
				{#each col.items as lead (lead.id)}
					<li
						class="rounded-lg border border-line bg-bg p-3 {dragging === lead.id ? 'opacity-40' : ''}"
						draggable={data.canWork}
						ondragstart={() => (dragging = lead.id)}
						ondragend={() => (dragging = dropTarget = null)}
					>
						<button class="w-full text-left" onclick={() => (openLead = openLead === lead.id ? null : lead.id)}>
							<p class="font-medium">{lead.name}</p>
							{#if lead.company}<p class="text-sm text-ink-2">{lead.company}</p>{/if}
							<p class="mt-1 text-xs text-ink-3">
								{money.format(Number(lead.estimated_value))}
								{#if lead.owner_id && data.owners[lead.owner_id]} · {data.owners[lead.owner_id]}{/if}
							</p>
						</button>

						{#if openLead === lead.id}
							<div class="mt-3 space-y-3 border-t border-line pt-3">
								{#if lead.phone}
									<a class="btn-ghost w-full" href="tel:{lead.phone}">Call {lead.phone}</a>
								{/if}
								{#if data.canWork}
									<div class="grid grid-cols-2 gap-2">
										{#each QUICK_ACTIVITIES as a (a.id)}
											<button class="btn-ghost px-2 text-xs" onclick={() => log(lead.id, a.id, a.label)}>{a.label}</button>
										{/each}
									</div>
									<label class="block">
										<span class="label">Move to</span>
										<select class="input" value={pending[lead.id] ?? lead.stage} onchange={(e) => move(lead.id, e.currentTarget.value)}>
											{#each LEAD_STAGES as s (s.id)}<option value={s.id}>{s.label}</option>{/each}
										</select>
									</label>
								{/if}
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>

{#if toast}
	<div class="fixed inset-x-0 bottom-20 z-30 mx-auto w-fit rounded-full bg-ink px-4 py-2 text-sm text-bg shadow-lg sm:bottom-6" role="status">
		{toast}
	</div>
{/if}
