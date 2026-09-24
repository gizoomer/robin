<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import SetupTabs from '$lib/components/SetupTabs.svelte';
	import { money } from '$lib/metrics';
	import { PROVIDERS } from '$lib/providers';

	let { data, form } = $props();

	let busy = $state<string | null>(null);
	let byProvider = $derived(Object.fromEntries(data.integrations.map((i) => [i.provider, i])));
	let live = $derived(PROVIDERS.filter((p) => p.available));
	let soon = $derived(PROVIDERS.filter((p) => !p.available));

	const submitting = (key: string) => () => {
		busy = key;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			busy = null;
		};
	};

	type Opt = { id: string; label: string; igUserId?: string };
	function opts(provider: string, key: string): Opt[] {
		const o = data.options[provider];
		return o && !('error' in o) ? ((o as Record<string, Opt[]>)[key] ?? []) : [];
	}
	function optError(provider: string) {
		const o = data.options[provider];
		return o && 'error' in o ? (o as { error: string }).error : null;
	}
</script>

<SetupTabs slug={data.org.slug} />

<div class="max-w-3xl">
	<p class="text-sm text-ink-2">Connect once. Data refreshes every night, and you can sync any time. Each platform is connected separately, so a client can share ads without sharing analytics.</p>

	{#if page.url.searchParams.get('error')}
		<p class="mt-4 rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{page.url.searchParams.get('error')}</p>
	{/if}
	{#if form && 'synced' in form}
		<p class="mt-4 rounded-lg bg-good/10 px-3 py-2 text-sm text-good" role="status">Synced {form.synced} data points.</p>
		{#each form.warnings ?? [] as w}<p class="mt-1 text-xs text-ink-2">{w}</p>{/each}
	{/if}
	{#if form && 'error' in form && form.error}<p class="mt-4 text-sm text-bad">{form.error}</p>{/if}

	<div class="mt-6 space-y-4">
		{#each live as p (p.id)}
			{@const integ = byProvider[p.id]}
			{@const optErr = optError(p.id)}
			<section class="card p-4">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h2 class="font-semibold">{p.name} {#if p.category === 'ads'}<span class="ml-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">Ads</span>{/if}</h2>
						<p class="text-sm text-ink-2">{p.covers}</p>
						{#if integ}
							<p class="mt-1 text-xs {integ.status === 'error' ? 'font-semibold text-bad' : 'text-ink-3'}">
								{integ.status === 'connected' ? '● Connected' : integ.status === 'error' ? '⚠ Needs attention' : '● Choose accounts below'}
								{#if integ.last_synced_at} · last sync {new Date(integ.last_synced_at).toLocaleString()}{/if}
							</p>
							{#if integ.last_error}<p class="mt-1 text-xs text-ink-2">{integ.last_error}</p>{/if}
						{/if}
					</div>
					<div class="flex gap-2">
						<a class={integ ? 'btn-ghost' : 'btn-primary'} href="/api/integrations/{p.id}/start?org={data.org.slug}" data-sveltekit-reload>
							{integ ? 'Reconnect' : 'Connect'}
						</a>
						{#if integ}
							<form method="POST" action="?/disconnect" use:enhance={submitting(`dc-${p.id}`)}>
								<input type="hidden" name="provider" value={p.id} />
								<button class="btn-ghost text-bad" disabled={busy !== null}>Disconnect</button>
							</form>
						{/if}
					</div>
				</div>

				{#if integ}
					{#if optErr}
						<p class="mt-3 text-sm text-bad">{optErr}</p>
					{:else}
						<form method="POST" action="?/configure" class="mt-4 space-y-3 border-t border-line pt-4" use:enhance={submitting(`cfg-${p.id}`)}>
							<input type="hidden" name="provider" value={p.id} />
							{#each p.pickers as f (f.key)}
								<label class="block">
									<span class="label">{f.label}</span>
									<select class="input" name={f.field} value={integ.config?.[f.field] ?? opts(p.id, f.key)[0]?.id ?? ''}>
										<option value="">Don't track</option>
										{#each opts(p.id, f.key) as o (o.id)}<option value={o.id}>{o.label}</option>{/each}
									</select>
									{#if opts(p.id, f.key).length === 0}<span class="text-xs text-ink-3">None found on this account.</span>{/if}
								</label>
								{#if p.id === 'meta'}
									{#each opts('meta', f.key) as o (o.id)}
										<input type="hidden" name="name:{o.id}" value={o.label} />
										{#if o.igUserId}<input type="hidden" name="ig:{o.id}" value={o.igUserId} />{/if}
									{/each}
								{/if}
							{/each}
							<div class="flex gap-2">
								<button class="btn-primary" disabled={busy !== null}>{busy === `cfg-${p.id}` ? 'Saving + syncing…' : 'Save and sync'}</button>
								{#if integ.status !== 'pending_setup'}
									<button class="btn-ghost" formaction="?/sync" disabled={busy !== null}>Sync now</button>
								{/if}
							</div>
						</form>
					{/if}
				{/if}
			</section>
		{/each}
	</div>

	<h2 class="mt-8 font-semibold">Coming soon</h2>
	<div class="mt-3 grid gap-3 sm:grid-cols-2">
		{#each soon as p (p.id)}
			<div class="card flex items-center justify-between gap-3 p-4 opacity-70">
				<div>
					<p class="font-medium">{p.name}</p>
					<p class="text-xs text-ink-2">{p.covers}</p>
				</div>
				<span class="rounded-full border border-line px-2 py-0.5 text-xs text-ink-3">Soon</span>
			</div>
		{/each}
	</div>

	<section class="card mt-8 p-4">
		<h2 class="font-semibold">Other marketing spend</h2>
		<p class="text-sm text-ink-2">Google Ads and Meta Ads spend is pulled in automatically. Add anything else here (SEO retainer, print, radio) so cost per lead and ROI are complete.</p>
		<form method="POST" action="?/spend" use:enhance={submitting('spend')} class="mt-3 grid gap-2 sm:grid-cols-4">
			<input class="input" name="channel" placeholder="Channel (e.g. SEO retainer)" required list="channels" />
			<datalist id="channels"><option>SEO retainer</option><option>Door hangers</option><option>Radio</option><option>Billboard</option></datalist>
			<input class="input" name="month" type="month" required />
			<input class="input" name="amount" inputmode="decimal" placeholder="Amount ($)" required />
			<button class="btn-primary" disabled={busy !== null}>Save</button>
		</form>
		{#if form && 'spendError' in form}<p class="mt-2 text-sm text-bad">{form.spendError}</p>{/if}
		{#if data.spend.length}
			<table class="mt-4 w-full text-sm">
				<tbody class="tabular-nums">
					{#each data.spend as s (s.id)}
						<tr class="border-t border-line"><td class="py-2">{s.month.slice(0, 7)}</td><td>{s.channel}</td><td class="text-right">{money.format(Number(s.amount))}</td></tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>
</div>
