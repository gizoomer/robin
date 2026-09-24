<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();
</script>

<main class="mx-auto max-w-2xl px-4 py-10">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-semibold">Clients</h1>
		<form method="POST" action="/logout"><button class="text-sm text-ink-2 hover:text-ink">Sign out</button></form>
	</div>

	{#if data.orgs.length === 0}
		<p class="mt-6 text-ink-2">
			{data.isAgency ? 'No clients yet. Add your first one below.' : 'Your account is not linked to a business yet. Ask your MYCMO contact to invite you.'}
		</p>
	{:else}
		<ul class="mt-6 space-y-2">
			{#each data.orgs as org (org.id)}
				<li>
					<a href="/app/{org.slug}" class="card flex min-h-14 items-center justify-between px-4 hover:border-accent">
						<span class="font-medium">{org.name}</span><span class="text-ink-3" aria-hidden="true">→</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}

	{#if data.isAgency}
		<form method="POST" action="?/createOrg" use:enhance class="card mt-8 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
			<div class="flex-1">
				<label class="label" for="name">New client name</label>
				<input class="input" id="name" name="name" required placeholder="Acme Roofing" />
			</div>
			<button class="btn-primary">Add client</button>
		</form>
		{#if form?.error}<p class="mt-2 text-sm text-bad">{form.error}</p>{/if}
	{/if}
</main>
