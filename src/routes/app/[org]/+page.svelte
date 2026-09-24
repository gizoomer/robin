<script lang="ts">
	import StatTile from '$lib/components/StatTile.svelte';
	import { SOURCES, formatValue, money, type SourceId } from '$lib/metrics';

	let { data } = $props();

	let sources = $derived((Object.keys(SOURCES) as SourceId[]).filter((s) => data.tiles[s].length));
	const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);
</script>

<section>
	<p class="text-sm text-ink-2">Open pipeline</p>
	<p class="text-5xl font-semibold tracking-tight">{money.format(data.pipeline.openValue)}</p>
	<p class="mt-1 text-sm text-ink-2">{data.pipeline.openCount} open deals · {data.pipeline.wonCount} won all-time · win rate {pct(data.pipeline.winRate)}</p>
</section>

<section class="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
	<StatTile label="Won revenue" value={money.format(data.roi.wonRevenue)} />
	<StatTile label="Marketing spend" value={money.format(data.roi.spend)} />
	<StatTile label="Cost per lead" value={data.roi.costPerLead == null ? '—' : money.format(data.roi.costPerLead)} />
	<StatTile label="Marketing ROI" value={pct(data.roi.roi)} />
</section>
<p class="mt-2 text-xs text-ink-3">
	Spend, cost and ROI since {new Date(data.roi.since + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })}.
</p>

{#if sources.length === 0}
	<div class="card mt-8 p-6">
		<h2 class="font-semibold">No marketing data yet</h2>
		<p class="mt-1 text-sm text-ink-2">
			Connect Google (Analytics, Search Console, YouTube) and Meta (Facebook, Instagram) to see traffic, search and social here.
			{#if data.canManage}<a class="font-semibold text-accent" href="/app/{data.org.slug}/integrations">Connect accounts</a>{/if}
		</p>
	</div>
{/if}

{#each sources as source (source)}
	<section class="mt-8">
		<h2 class="mb-3 text-lg font-semibold">{SOURCES[source].label} <span class="text-sm font-normal text-ink-3">last 30 days</span></h2>
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.tiles[source] as t (t.def.metric)}
				<StatTile
					label={t.def.label}
					value={formatValue(t.value, t.def.format)}
					delta={t.def.agg === 'last' ? null : t.delta}
					upIsGood={t.def.upIsGood ?? true}
					spark={t.def.agg === 'last' ? [] : t.spark}
					format={(v) => formatValue(v, t.def.format)}
				/>
			{/each}
		</div>
	</section>
{/each}

<div class="mt-8 grid gap-6 lg:grid-cols-3">
	<section class="card overflow-x-auto p-4 lg:col-span-2">
		<h2 class="font-semibold">Rep scoreboard</h2>
		{#if data.reps.length === 0}
			<p class="mt-2 text-sm text-ink-2">No assigned leads or activity yet.</p>
		{:else}
			<table class="mt-3 w-full min-w-[480px] text-sm">
				<thead class="text-left text-ink-2">
					<tr><th class="py-2 font-medium">Rep</th><th class="font-medium">Leads</th><th class="font-medium">Win rate</th><th class="font-medium">Won</th><th class="font-medium">Activity (7d)</th></tr>
				</thead>
				<tbody class="tabular-nums">
					{#each data.reps as r (r.id)}
						<tr class="border-t border-line">
							<td class="py-2 font-medium">{r.name}</td><td>{r.leads}</td><td>{pct(r.winRate)}</td><td>{money.format(r.wonValue)}</td><td>{r.activities}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>

	<section class="card p-4">
		<div class="flex items-center justify-between">
			<h2 class="font-semibold">Latest huddle</h2>
			<a href="/app/{data.org.slug}/huddle" class="text-sm text-accent">All</a>
		</div>
		{#if data.huddle}
			<p class="mt-1 text-xs text-ink-3">{data.huddle.huddle_date}</p>
			<dl class="mt-2 space-y-2 text-sm">
				{#if data.huddle.wins}<div><dt class="font-medium text-ink-2">Wins</dt><dd>{data.huddle.wins}</dd></div>{/if}
				{#if data.huddle.blockers}<div><dt class="font-medium text-ink-2">Blockers</dt><dd>{data.huddle.blockers}</dd></div>{/if}
				{#if data.huddle.focus}<div><dt class="font-medium text-ink-2">Today's focus</dt><dd>{data.huddle.focus}</dd></div>{/if}
			</dl>
		{:else}
			<p class="mt-2 text-sm text-ink-2">No huddle logged yet.</p>
		{/if}
	</section>
</div>
