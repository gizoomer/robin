<script lang="ts">
	let {
		points,
		label,
		format = (v: number) => String(v),
		height = 40
	}: {
		points: { day: string; value: number }[];
		label: string;
		format?: (v: number) => string;
		height?: number;
	} = $props();

	const W = 200;
	let hover = $state<number | null>(null);

	let min = $derived(Math.min(...points.map((p) => p.value)));
	let max = $derived(Math.max(...points.map((p) => p.value)));
	let x = $derived((i: number) => (points.length <= 1 ? W / 2 : (i / (points.length - 1)) * W));
	let y = $derived((v: number) => (max === min ? height / 2 : height - 3 - ((v - min) / (max - min)) * (height - 6)));
	let path = $derived(points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(''));

	function onMove(e: PointerEvent) {
		const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
		const ratio = (e.clientX - rect.left) / rect.width;
		hover = Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1))));
	}
</script>

<div class="relative">
	<svg
		viewBox="0 0 {W} {height}"
		preserveAspectRatio="none"
		class="block h-10 w-full touch-none overflow-visible"
		role="img"
		aria-label="{label} daily trend"
		onpointermove={onMove}
		onpointerleave={() => (hover = null)}
	>
		<path d={path} fill="none" stroke="var(--series-1)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
		{#if hover !== null}
			<line x1={x(hover)} x2={x(hover)} y1="0" y2={height} stroke="var(--ink-3)" stroke-width="1" vector-effect="non-scaling-stroke" />
		{/if}
	</svg>
	{#if hover !== null}
		{@const p = points[hover]}
		<div
			class="pointer-events-none absolute -top-9 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-1 text-xs shadow"
			style="left: {(x(hover) / W) * 100}%"
		>
			<span class="text-ink-3">{new Date(p.day + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</span>
			<span class="ml-1 font-semibold text-ink">{format(p.value)}</span>
		</div>
	{/if}
</div>
