<script lang="ts">
	import { page } from '$app/state';
	let { data, children } = $props();

	let base = $derived(`/app/${data.org.slug}`);
	let links = $derived([
		{ href: base, label: 'Overview', show: true },
		{ href: `${base}/pipeline`, label: 'Pipeline', show: true },
		{ href: `${base}/leads/new`, label: 'Add lead', show: data.canWork },
		{ href: `${base}/huddle`, label: 'Huddle', show: true },
		{ href: `${base}/integrations`, label: 'Connections', show: data.canManage }
	].filter((l) => l.show));
</script>

<div class="min-h-dvh pb-20 sm:pb-0">
	<header class="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
		<div class="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
			<a href="/app" class="text-sm font-bold tracking-wide text-accent">MYCMO</a>
			<span class="truncate font-semibold">{data.org.name}</span>
			<nav class="ml-auto hidden gap-1 sm:flex">
				{#each links as l (l.href)}
					<a
						href={l.href}
						class="rounded-md px-3 py-2 text-sm {page.url.pathname === l.href ? 'bg-bg font-semibold text-ink' : 'text-ink-2 hover:text-ink'}"
						>{l.label}</a
					>
				{/each}
			</nav>
		</div>
	</header>

	<main class="mx-auto max-w-6xl px-4 py-6">
		{@render children()}
	</main>

	<!-- Mobile bottom nav: reps live on their phones -->
	<nav class="fixed inset-x-0 bottom-0 z-20 grid border-t border-line bg-surface sm:hidden" style="grid-template-columns: repeat({links.length}, 1fr)">
		{#each links as l (l.href)}
			<a
				href={l.href}
				class="flex min-h-14 items-center justify-center text-xs {page.url.pathname === l.href ? 'font-semibold text-accent' : 'text-ink-2'}"
				>{l.label}</a
			>
		{/each}
	</nav>
</div>
