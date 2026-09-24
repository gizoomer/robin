<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();
</script>

<div class="mx-auto max-w-2xl">
	<h1 class="text-xl font-semibold">Daily sales huddle</h1>

	{#if data.canWork}
		<form method="POST" use:enhance class="card mt-4 space-y-3 p-4">
			<div><label class="label" for="wins">Wins since yesterday</label><textarea class="input py-2" id="wins" name="wins" rows="2"></textarea></div>
			<div><label class="label" for="blockers">Blockers</label><textarea class="input py-2" id="blockers" name="blockers" rows="2"></textarea></div>
			<div><label class="label" for="focus">Today's focus</label><textarea class="input py-2" id="focus" name="focus" rows="2"></textarea></div>
			{#if form?.error}<p class="text-sm text-bad">{form.error}</p>{/if}
			<button class="btn-primary w-full sm:w-auto">Post huddle</button>
		</form>
	{/if}

	<ol class="mt-6 space-y-3">
		{#each data.notes as n (n.id)}
			<li class="card p-4 text-sm">
				<p class="text-xs font-semibold text-ink-3">{n.huddle_date}</p>
				{#if n.wins}<p class="mt-2"><span class="font-medium text-ink-2">Wins:</span> {n.wins}</p>{/if}
				{#if n.blockers}<p class="mt-1"><span class="font-medium text-ink-2">Blockers:</span> {n.blockers}</p>{/if}
				{#if n.focus}<p class="mt-1"><span class="font-medium text-ink-2">Focus:</span> {n.focus}</p>{/if}
			</li>
		{:else}
			<li class="text-sm text-ink-2">No huddles yet.</li>
		{/each}
	</ol>
</div>
