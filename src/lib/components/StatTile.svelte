<script lang="ts">
	import Sparkline from './Sparkline.svelte';

	let {
		label,
		value,
		delta = null,
		upIsGood = true,
		period = 'prior 30 days',
		spark = [],
		format = (v: number) => String(v)
	}: {
		label: string;
		value: string;
		delta?: number | null;
		upIsGood?: boolean;
		period?: string;
		spark?: { day: string; value: number }[];
		format?: (v: number) => string;
	} = $props();

	let good = $derived(delta == null || delta === 0 ? null : delta > 0 === upIsGood);
</script>

<div class="card flex flex-col gap-1 p-4">
	<p class="text-sm text-ink-2">{label}</p>
	<p class="text-2xl font-semibold tracking-tight text-ink">{value}</p>
	{#if delta != null}
		<p class="text-xs text-ink-2">
			<span class="font-semibold {good === null ? 'text-ink-2' : good ? 'text-good' : 'text-bad'}">
				{delta > 0 ? '▲' : delta < 0 ? '▼' : '•'}
				{Math.abs(delta * 100).toFixed(0)}%
			</span>
			vs {period}
		</p>
	{/if}
	{#if spark.length > 1}
		<div class="mt-2"><Sparkline points={spark} {label} {format} /></div>
	{/if}
</div>
