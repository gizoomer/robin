<script lang="ts">
	import { page } from '$app/state';
	let { slug }: { slug: string } = $props();
	let tabs = $derived([
		{ href: `/app/${slug}/team`, label: 'Team & access' },
		{ href: `/app/${slug}/kpis`, label: 'KPIs & goals' },
		{ href: `/app/${slug}/integrations`, label: 'Connections' }
	]);
</script>

<nav class="mb-6 flex gap-1 overflow-x-auto border-b border-line" aria-label="Client setup">
	{#each tabs as t (t.href)}
		<a
			href={t.href}
			class="-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm {page.url.pathname === t.href ? 'border-accent font-semibold text-ink' : 'border-transparent text-ink-2 hover:text-ink'}"
			>{t.label}</a
		>
	{/each}
</nav>
