<script lang="ts">
	import { page } from '$app/state';
	let { data, children } = $props();

	let base = $derived(`/app/${data.org.slug}`);
	let links = $derived(
		[
			{ href: base, label: 'Overview', show: true },
			{ href: `${base}/pipeline`, label: 'Pipeline', show: true },
			{ href: `${base}/leads/new`, label: 'Add lead', show: data.canWork },
			{ href: `${base}/huddle`, label: 'Huddle', show: true },
			{ href: `${base}/team`, label: 'Setup', show: data.canManage, match: ['/team', '/kpis', '/integrations'] }
		].filter((l) => l.show)
	);
	const active = (l: { href: string; match?: string[] }) =>
		page.url.pathname === l.href || !!l.match?.some((m) => page.url.pathname === base + m);

	const ROLE_LABEL: Record<string, string> = { agency: 'Super admin', owner: 'Owner', rep: 'Sales rep', viewer: 'View only' };
</script>

<div class="min-h-dvh pb-20 sm:pb-0">
	<header class="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
		<div class="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
			{#if data.role === 'agency'}
				<a href="/app" class="text-sm text-ink-2 hover:text-ink" title="All clients">← <span class="hidden sm:inline">All clients</span></a>
			{:else}
				<a href="/app" class="text-sm font-bold tracking-wide text-accent">MYCMO</a>
			{/if}
			<span class="truncate font-semibold">{data.org.name}</span>
			<span class="hidden rounded-full border border-line px-2 py-0.5 text-xs text-ink-2 sm:inline">{ROLE_LABEL[data.role]}</span>
			<nav class="ml-auto hidden gap-1 sm:flex">
				{#each links as l (l.href)}
					<a href={l.href} class="rounded-md px-3 py-2 text-sm {active(l) ? 'bg-bg font-semibold text-ink' : 'text-ink-2 hover:text-ink'}">{l.label}</a>
				{/each}
			</nav>
			<form method="POST" action="/logout" class="ml-auto sm:ml-2"><button class="text-sm text-ink-2 hover:text-ink">Sign out</button></form>
		</div>
	</header>

	<main class="mx-auto max-w-6xl px-4 py-6">
		{@render children()}
	</main>

	<!-- Mobile bottom nav: reps live on their phones -->
	<nav class="fixed inset-x-0 bottom-0 z-20 grid border-t border-line bg-surface sm:hidden" style="grid-template-columns: repeat({links.length}, 1fr)">
		{#each links as l (l.href)}
			<a href={l.href} class="flex min-h-14 items-center justify-center text-xs {active(l) ? 'font-semibold text-accent' : 'text-ink-2'}">{l.label}</a>
		{/each}
	</nav>
</div>
