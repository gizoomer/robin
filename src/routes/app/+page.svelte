<script lang="ts">
	import { enhance } from '$app/forms';
	import StatTile from '$lib/components/StatTile.svelte';
	import { formatValue, money } from '$lib/metrics';

	let { data, form } = $props();

	let filter = $state<'all' | 'attention'>('all');
	let query = $state('');
	let adding = $state(false);

	let attention = $derived(data.clients.filter((c) => c.alerts.length));
	let rows = $derived(
		(filter === 'attention' ? attention : [...data.clients].sort((a, b) => b.alerts.length - a.alerts.length || a.name.localeCompare(b.name))).filter(
			(c) => !query || c.name.toLowerCase().includes(query.toLowerCase())
		)
	);
	let totals = $derived({
		pipeline: data.clients.reduce((a, c) => a + c.openPipeline, 0),
		won: data.clients.reduce((a, c) => a + c.wonValue30, 0),
		adSpend: data.clients.reduce((a, c) => a + c.adSpend30, 0),
		users: data.clients.reduce((a, c) => a + c.members, 0)
	});
	const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);
</script>

<div class="min-h-dvh">
	<header class="border-b border-line bg-surface">
		<div class="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
			<span class="text-sm font-bold tracking-wide text-accent">MYCMO</span>
			<span class="font-semibold">{data.isAgency ? 'All clients' : 'Your businesses'}</span>
			<form method="POST" action="/logout" class="ml-auto"><button class="text-sm text-ink-2 hover:text-ink">Sign out</button></form>
		</div>
	</header>

	<main class="mx-auto max-w-6xl px-4 py-6">
		{#if !data.isAgency}
			{#if data.orgs.length === 0}
				<p class="text-ink-2">Your account is not linked to a business yet. Ask your MYCMO contact to invite you.</p>
			{:else}
				<ul class="space-y-2">
					{#each data.orgs as org (org.id)}
						<li><a href="/app/{org.slug}" class="card flex min-h-14 items-center justify-between px-4 hover:border-accent"><span class="font-medium">{org.name}</span><span aria-hidden="true">→</span></a></li>
					{/each}
				</ul>
			{/if}
		{:else}
			<section class="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<StatTile label="Active clients" value={String(data.clients.length)} />
				<StatTile label="Needs attention" value={String(attention.length)} />
				<StatTile label="Client pipeline (open)" value={money.format(totals.pipeline)} />
				<StatTile label="Ad spend managed, 30 days" value={money.format(totals.adSpend)} />
			</section>

			<div class="mt-6 flex flex-wrap items-center gap-2">
				<div class="flex rounded-lg border border-line bg-surface p-1 text-sm" role="tablist">
					<button role="tab" aria-selected={filter === 'all'} class="rounded-md px-3 py-1.5 {filter === 'all' ? 'bg-bg font-semibold' : 'text-ink-2'}" onclick={() => (filter = 'all')}>All {data.clients.length}</button>
					<button role="tab" aria-selected={filter === 'attention'} class="rounded-md px-3 py-1.5 {filter === 'attention' ? 'bg-bg font-semibold' : 'text-ink-2'}" onclick={() => (filter = 'attention')}>Needs attention {attention.length}</button>
				</div>
				<input class="input max-w-56" type="search" placeholder="Search clients" bind:value={query} aria-label="Search clients" />
				<button class="btn-primary ml-auto" onclick={() => (adding = !adding)}>+ New client</button>
			</div>

			{#if adding}
				<form method="POST" action="?/createOrg" use:enhance class="card mt-3 grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
					<div><label class="label" for="name">Business name</label><input class="input" id="name" name="name" required placeholder="Acme Roofing" /></div>
					<div><label class="label" for="industry">Industry</label><input class="input" id="industry" name="industry" placeholder="Roofing" /></div>
					<button class="btn-primary">Create and invite team</button>
				</form>
				{#if form?.error}<p class="mt-2 text-sm text-bad">{form.error}</p>{/if}
			{/if}

			<!-- Desktop: table. Phone: cards. -->
			<div class="card mt-4 hidden overflow-x-auto md:block">
				<table class="w-full text-sm">
					<thead class="text-left text-ink-2">
						<tr class="border-b border-line">
							<th class="px-4 py-3 font-medium">Client</th>
							<th class="px-2 font-medium">KPI goals</th>
							<th class="px-2 font-medium">Website visits</th>
							<th class="px-2 font-medium">New leads</th>
							<th class="px-2 font-medium">Open pipeline</th>
							<th class="px-2 font-medium">Ad spend</th>
							<th class="px-2 font-medium">Users</th>
							<th class="px-4 font-medium">Status</th>
						</tr>
					</thead>
					<tbody class="tabular-nums">
						{#each rows as c (c.id)}
							<tr class="border-b border-line last:border-0 hover:bg-bg">
								<td class="px-4 py-3">
									<a href="/app/{c.slug}" class="font-semibold hover:text-accent">{c.name}</a>
									<div class="text-xs text-ink-3">{c.industry ?? ''}</div>
								</td>
								<td class="px-2">
									{#if c.kpiAttainment != null}
										<div class="flex items-center gap-2">
											<div class="h-1.5 w-16 rounded-full bg-line"><div class="h-1.5 rounded-full {c.kpiAttainment >= 1 ? 'bg-good' : c.kpiAttainment >= 0.8 ? 'bg-accent' : 'bg-bad'}" style="width: {Math.min(c.kpiAttainment, 1) * 100}%"></div></div>
											<span>{pct(c.kpiAttainment)}</span>
										</div>
									{:else}<span class="text-ink-3">Not set</span>{/if}
								</td>
								<td class="px-2">
									{c.sessions == null ? '—' : formatValue(c.sessions)}
									{#if c.sessionsDelta != null}<span class="ml-1 text-xs {c.sessionsDelta >= 0 ? 'text-good' : 'text-bad'}">{c.sessionsDelta >= 0 ? '▲' : '▼'}{Math.abs(Math.round(c.sessionsDelta * 100))}%</span>{/if}
								</td>
								<td class="px-2">{c.newLeads30}</td>
								<td class="px-2">{money.format(c.openPipeline)}</td>
								<td class="px-2">{c.adSpend30 ? money.format(c.adSpend30) : '—'}</td>
								<td class="px-2">{c.members}</td>
								<td class="px-4">
									{#if c.alerts.length}
										<span class="text-xs font-semibold text-bad">⚠ {c.alerts[0]}</span>
									{:else}
										<span class="text-xs text-good">● On track</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<ul class="mt-4 space-y-2 md:hidden">
				{#each rows as c (c.id)}
					<li>
						<a href="/app/{c.slug}" class="card block p-4">
							<div class="flex items-start justify-between gap-2">
								<span class="font-semibold">{c.name}</span>
								<span class="text-sm tabular-nums">{money.format(c.openPipeline)}</span>
							</div>
							<p class="mt-1 text-xs text-ink-2">KPI goals {pct(c.kpiAttainment)} · {c.newLeads30} new leads · {c.members} users</p>
							{#if c.alerts.length}<p class="mt-1 text-xs font-semibold text-bad">⚠ {c.alerts.join(' · ')}</p>{/if}
						</a>
					</li>
				{/each}
			</ul>
			<p class="mt-3 text-xs text-ink-3">Last 30 days. KPI goals = average progress toward each client's monthly targets.</p>
		{/if}
	</main>
</div>
