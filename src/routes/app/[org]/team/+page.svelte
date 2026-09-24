<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import SetupTabs from '$lib/components/SetupTabs.svelte';

	let { data, form } = $props();

	const ROLES = [
		{ id: 'owner', label: 'Owner', help: 'Everything: dashboard, team, KPIs, connections, all leads' },
		{ id: 'rep', label: 'Sales rep', help: 'Pipeline, add leads, log activity on their own leads' },
		{ id: 'viewer', label: 'View only', help: 'Sees the dashboard, cannot change anything' }
	];
</script>

<SetupTabs slug={data.org.slug} />

{#if page.url.searchParams.get('new')}
	<p class="mb-4 rounded-lg bg-accent/10 px-3 py-2 text-sm">
		<strong>{data.org.name}</strong> is set up. Next: invite the owner and their staff below, then pick their KPIs and connect their accounts.
	</p>
{/if}

<div class="grid gap-6 lg:grid-cols-[1fr_22rem]">
	<section class="card overflow-hidden">
		<h2 class="border-b border-line px-4 py-3 font-semibold">People with access <span class="font-normal text-ink-3">{data.members.length}</span></h2>
		<ul>
			{#each data.members as m (m.user_id)}
				<li class="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-0">
					<div class="min-w-0 flex-1">
						<p class="truncate font-medium">{m.name || m.email}{#if m.user_id === data.userId} <span class="text-xs text-ink-3">(you)</span>{/if}</p>
						<p class="truncate text-xs text-ink-2">{m.email}</p>
					</div>
					<form method="POST" action="?/role" use:enhance>
						<input type="hidden" name="user" value={m.user_id} />
						<select name="role" class="input min-h-9 w-auto py-1 text-sm" value={m.role} onchange={(e) => e.currentTarget.form?.requestSubmit()} aria-label="Role for {m.name}">
							{#each ROLES as r (r.id)}<option value={r.id}>{r.label}</option>{/each}
						</select>
					</form>
					<form method="POST" action="?/remove" use:enhance={({ cancel }) => { if (!confirm(`Remove ${m.name || m.email} from ${data.org.name}?`)) cancel(); }}>
						<input type="hidden" name="user" value={m.user_id} />
						<button class="text-sm text-bad hover:underline">Remove</button>
					</form>
				</li>
			{:else}
				<li class="px-4 py-6 text-sm text-ink-2">Nobody yet. Invite the business owner first.</li>
			{/each}
		</ul>
	</section>

	<section class="card h-fit p-4">
		<h2 class="font-semibold">Invite someone</h2>
		<p class="text-sm text-ink-2">They get an email with a sign-in link.</p>
		<form method="POST" action="?/invite" use:enhance class="mt-3 space-y-3">
			<div><label class="label" for="iname">Name</label><input class="input" id="iname" name="name" autocomplete="off" /></div>
			<div><label class="label" for="iemail">Email *</label><input class="input" id="iemail" name="email" type="email" required autocomplete="off" /></div>
			<fieldset>
				<legend class="label">Role</legend>
				<div class="space-y-2">
					{#each ROLES as r, i (r.id)}
						<label class="flex cursor-pointer gap-2 rounded-lg border border-line p-2 text-sm has-[:checked]:border-accent">
							<input type="radio" name="role" value={r.id} checked={i === 1} class="mt-1" />
							<span><span class="font-medium">{r.label}</span><span class="block text-xs text-ink-2">{r.help}</span></span>
						</label>
					{/each}
				</div>
			</fieldset>
			{#if form && 'error' in form && form.error}<p class="text-sm text-bad">{form.error}</p>{/if}
			{#if form && 'invited' in form}<p class="text-sm text-good" role="status">Invite sent to {form.invited}.</p>{/if}
			<button class="btn-primary w-full">Send invite</button>
		</form>
	</section>
</div>
