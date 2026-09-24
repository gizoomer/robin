<script lang="ts">
	import { enhance } from '$app/forms';
	import { env } from '$env/dynamic/public';
	let { data, form } = $props();
	let adding = $state(false);
	const base = env.PUBLIC_APP_URL ?? 'https://app.yourdomain.com';
</script>

<main class="mx-auto max-w-4xl px-4 py-8">
	<a href="/app" class="text-sm text-ink-2 hover:text-ink">← Accounts</a>
	<div class="mt-2 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-semibold">Partner apps</h1>
			<p class="mt-1 max-w-2xl text-sm text-ink-2">
				Outside firms that send their own numbers into client dashboards through the MYCMO Partner API. Register the firm and the
				metrics it may send here. Each client's admin then creates that firm a key on their Connections page.
			</p>
		</div>
		<button class="btn-primary" onclick={() => (adding = !adding)}>+ Register partner</button>
	</div>

	{#if form?.error}<p class="mt-4 rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{form.error}</p>{/if}
	{#if form && 'created' in form}<p class="mt-4 rounded-lg bg-good/10 px-3 py-2 text-sm text-good" role="status">{form.created} is registered.</p>{/if}

	{#if adding}
		<form method="POST" action="?/create" use:enhance class="card mt-4 grid gap-3 p-4 sm:grid-cols-2">
			<div><label class="label" for="p-name">Partner name</label><input class="input" id="p-name" name="name" required /></div>
			<div><label class="label" for="p-web">Website</label><input class="input" id="p-web" name="website" type="url" placeholder="https://" /></div>
			<div><label class="label" for="p-email">Technical contact email</label><input class="input" id="p-email" name="email" type="email" /></div>
			<div><label class="label" for="p-desc">What it does</label><input class="input" id="p-desc" name="description" /></div>
			<div class="sm:col-span-2">
				<label class="label" for="p-metrics">Metrics they will send, one per line: <code>key | label | total | format</code></label>
				<textarea class="input py-2 font-mono text-sm" id="p-metrics" name="metrics" rows="4" required placeholder={'calls | Phone calls | sum\nrevenue | Revenue | sum | money\nrating | Average rating | avg | decimal'}></textarea>
				<span class="text-xs text-ink-3">Total: sum (daily counts), avg (averages) or last (running totals like followers). Format is optional.</span>
			</div>
			<div class="sm:col-span-2"><button class="btn-primary">Register partner</button></div>
		</form>
	{/if}

	<ul class="mt-6 space-y-3">
		{#each data.apps as app (app.id)}
			<li class="card p-4">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<p class="font-semibold">{app.name} <span class="text-xs font-normal {app.status === 'active' ? 'text-good' : 'text-ink-3'}">● {app.status}</span></p>
						<p class="text-sm text-ink-2">{app.description ?? ''}</p>
						<p class="mt-1 text-xs text-ink-3">Source id <code>app:{app.slug}</code> · {app.activeKeys} active client keys</p>
					</div>
					<form method="POST" action="?/toggle" use:enhance>
						<input type="hidden" name="id" value={app.id} /><input type="hidden" name="status" value={app.status} />
						<button class="btn-ghost">{app.status === 'active' ? 'Disable' : 'Enable'}</button>
					</form>
				</div>
				<p class="mt-3 text-xs font-medium text-ink-2">Metrics</p>
				<p class="text-sm">{app.metrics.map((m) => `${m.label} (${m.metric})`).join(' · ')}</p>
			</li>
		{:else}
			<li class="text-sm text-ink-2">No partners yet.</li>
		{/each}
	</ul>

	<section class="card mt-8 p-4">
		<h2 class="font-semibold">What to send a partner's developers</h2>
		<p class="mt-1 text-sm text-ink-2">Each key only writes to one client account. Re-sending the same metric and date overwrites it.</p>
		<pre class="mt-3 overflow-x-auto rounded-lg bg-bg p-3 text-xs"><code>curl -X POST {base}/api/v1/partner/metrics \
  -H "Authorization: Bearer mycmo_pk_..." \
  -H "Content-Type: application/json" \
  -d '{`{"metrics":[{"metric":"calls","date":"2026-09-23","value":12}]}`}'

# Check a key and list allowed metrics:
curl {base}/api/v1/partner/me -H "Authorization: Bearer mycmo_pk_..."</code></pre>
	</section>
</main>
