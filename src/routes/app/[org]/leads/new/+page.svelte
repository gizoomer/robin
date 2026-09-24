<script lang="ts">
	import { enhance } from '$app/forms';
	import { LEAD_SOURCES } from '$lib/metrics';

	let { form } = $props();
	let source = $state('door_knock');
	let saving = $state(false);
	let formEl: HTMLFormElement;
</script>

<div class="mx-auto max-w-md">
	<h1 class="text-xl font-semibold">Quick-add lead</h1>
	{#if form?.saved}<p class="mt-2 rounded-lg bg-good/10 px-3 py-2 text-sm text-good" role="status">Saved {form.saved}. Add the next one.</p>{/if}

	<form
		bind:this={formEl}
		method="POST"
		class="mt-4 space-y-4"
		use:enhance={() => {
			saving = true;
			return async ({ result, update }) => {
				await update({ reset: result.type === 'success' });
				saving = false;
				if (result.type === 'success') formEl.querySelector<HTMLInputElement>('#name')?.focus();
			};
		}}
	>
		<div>
			<label class="label" for="name">Name *</label>
			<input class="input" id="name" name="name" required autocomplete="off" value={form?.values?.name ?? ''} />
		</div>
		<div>
			<label class="label" for="phone">Phone</label>
			<input class="input" id="phone" name="phone" type="tel" inputmode="tel" autocomplete="off" value={form?.values?.phone ?? ''} />
		</div>
		<div>
			<label class="label" for="company">Company</label>
			<input class="input" id="company" name="company" autocomplete="off" value={form?.values?.company ?? ''} />
		</div>
		<div>
			<label class="label" for="address">Address</label>
			<input class="input" id="address" name="address" autocomplete="street-address" value={form?.values?.address ?? ''} />
		</div>

		<fieldset>
			<legend class="label">Lead source</legend>
			<div class="grid grid-cols-3 gap-2">
				{#each LEAD_SOURCES as s (s.id)}
					<label class="btn-ghost cursor-pointer px-2 text-xs has-[:checked]:border-accent has-[:checked]:text-accent">
						<input class="sr-only" type="radio" name="source" value={s.id} bind:group={source} />{s.label}
					</label>
				{/each}
			</div>
		</fieldset>

		<div>
			<label class="label" for="value">Estimated deal value ($)</label>
			<input class="input" id="value" name="estimated_value" inputmode="decimal" placeholder="0" value={form?.values?.estimated_value ?? ''} />
		</div>

		{#if form?.error}<p class="text-sm text-bad">{form.error}</p>{/if}

		<div class="grid grid-cols-2 gap-2">
			<button class="btn-ghost" name="again" value="1" disabled={saving}>Save + add another</button>
			<button class="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save lead'}</button>
		</div>
	</form>
</div>
