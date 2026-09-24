<script lang="ts">
	let { data } = $props();

	const ROLE: Record<string, { label: string; sees: string }> = {
		owner: { label: 'Owner', sees: 'Full dashboard, team, KPIs, connections' },
		rep: { label: 'Sales rep', sees: 'Pipeline, add leads, log activity' },
		viewer: { label: 'Viewer', sees: 'Read-only dashboard' }
	};

	let query = $state('');
	let shown = $derived(
		data.clients.filter((c) => !query || c.org.toLowerCase().includes(query.toLowerCase()) || c.people.some((p) => p.name.toLowerCase().includes(query.toLowerCase())))
	);
</script>

<main class="mx-auto max-w-3xl px-4 py-10">
	<p class="text-sm font-semibold tracking-wide text-accent">MYCMO demo</p>
	<h1 class="mt-1 text-2xl font-semibold">Who do you want to sign in as?</h1>
	<p class="mt-1 text-sm text-ink-2">Everything is sample data. Switch any time from the bar at the top.</p>

	<form method="POST" class="mt-6">
		<input type="hidden" name="user" value={data.superAdmin} />
		<button class="card flex w-full items-center justify-between gap-4 border-accent p-4 text-left hover:bg-bg">
			<span>
				<span class="block font-semibold">Super admin (you, the CMO)</span>
				<span class="block text-sm text-ink-2">All 20 clients, portfolio view, set up access and KPIs for each client</span>
			</span>
			<span class="text-accent" aria-hidden="true">→</span>
		</button>
	</form>

	<div class="mt-8 flex flex-wrap items-end justify-between gap-3">
		<h2 class="text-lg font-semibold">Or sign in as a client's employee</h2>
		<input class="input max-w-60" type="search" placeholder="Search clients or people" bind:value={query} aria-label="Search clients or people" />
	</div>

	<div class="mt-3 grid gap-3 sm:grid-cols-2">
		{#each shown as c (c.slug)}
			<section class="card p-3">
				<h3 class="px-1 font-semibold">{c.org}</h3>
				<ul class="mt-2 space-y-1">
					{#each c.people as p (p.id)}
						<li>
							<form method="POST">
								<input type="hidden" name="user" value={p.id} />
								<input type="hidden" name="slug" value={c.slug} />
								<button class="flex min-h-11 w-full items-center justify-between rounded-lg px-2 text-left text-sm hover:bg-bg" title={ROLE[p.role]?.sees}>
									<span>{p.name}</span>
									<span class="text-xs text-ink-3">{ROLE[p.role]?.label ?? p.role}</span>
								</button>
							</form>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
</main>
