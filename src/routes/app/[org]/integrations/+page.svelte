<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { money } from '$lib/metrics';

	let { data, form } = $props();

	const PROVIDERS = [
		{ id: 'google', name: 'Google', covers: 'Google Analytics 4, Search Console, YouTube' },
		{ id: 'meta', name: 'Meta', covers: 'Facebook Page, Instagram Business' }
	] as const;

	let busy = $state<string | null>(null);
	let byProvider = $derived(Object.fromEntries(data.integrations.map((i) => [i.provider, i])));

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
</script>

<div class="mx-auto max-w-3xl">
	<h1 class="text-xl font-semibold">Connections</h1>
	<p class="mt-1 text-sm text-ink-2">Connect once. Data refreshes every night, and you can sync any time.</p>

	{#if page.url.searchParams.get('error')}
		<p class="mt-4 rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{page.url.searchParams.get('error')}</p>
	{/if}
	{#if form && 'synced' in form}
		<p class="mt-4 rounded-lg bg-good/10 px-3 py-2 text-sm text-good" role="status">Synced {form.synced} data points.</p>
		{#each form.warnings ?? [] as w}<p class="mt-1 text-xs text-ink-2">{w}</p>{/each}
	{/if}
	{#if form && 'error' in form && form.error}<p class="mt-4 text-sm text-bad">{form.error}</p>{/if}

	<div class="mt-6 space-y-4">
		{#each PROVIDERS as p (p.id)}
			{@const integ = byProvider[p.id]}
			{@const optErr = data.options[p.id] && 'error' in data.options[p.id] ? (data.options[p.id] as { error: string }).error : null}
			<section class="card p-4">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h2 class="font-semibold">{p.name}</h2>
						<p class="text-sm text-ink-2">{p.covers}</p>
						{#if integ}
							<p class="mt-1 text-xs {integ.status === 'error' ? 'text-bad' : 'text-ink-3'}">
								{integ.status === 'connected' ? '● Connected' : integ.status === 'error' ? '● Needs attention' : '● Choose accounts below'}
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
							{#if p.id === 'google'}
								{#each [{ key: 'ga4', field: 'ga4PropertyId', label: 'Google Analytics property' }, { key: 'gsc', field: 'gscSiteUrl', label: 'Search Console site' }, { key: 'youtube', field: 'youtubeChannelId', label: 'YouTube channel' }] as f (f.key)}
									<label class="block">
										<span class="label">{f.label}</span>
										<select class="input" name={f.field} value={integ.config?.[f.field] ?? ''}>
											<option value="">Don't track</option>
											{#each opts('google', f.key) as o (o.id)}<option value={o.id}>{o.label}</option>{/each}
										</select>
										{#if opts('google', f.key).length === 0}<span class="text-xs text-ink-3">None found on this Google account.</span>{/if}
									</label>
								{/each}
							{:else}
								<label class="block">
									<span class="label">Facebook Page (and linked Instagram)</span>
									<select class="input" name="pageId" value={integ.config?.pageId ?? ''}>
										<option value="">Choose a page</option>
										{#each opts('meta', 'pages') as o (o.id)}<option value={o.id}>{o.label}</option>{/each}
									</select>
								</label>
								{#each opts('meta', 'pages') as o (o.id)}
									<input type="hidden" name="name:{o.id}" value={o.label} />
									{#if o.igUserId}<input type="hidden" name="ig:{o.id}" value={o.igUserId} />{/if}
								{/each}
							{/if}
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

	<section class="card mt-8 p-4">
		<h2 class="font-semibold">Marketing spend</h2>
		<p class="text-sm text-ink-2">Monthly spend per channel. Used for cost per lead and ROI on the overview.</p>
		<form method="POST" action="?/spend" use:enhance={submitting('spend')} class="mt-3 grid gap-2 sm:grid-cols-4">
			<input class="input" name="channel" placeholder="Channel (e.g. Google Ads)" required list="channels" />
			<datalist id="channels"><option>Google Ads</option><option>Facebook Ads</option><option>SEO retainer</option><option>Door hangers</option></datalist>
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
