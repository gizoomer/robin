<script lang="ts">
	import { enhance } from '$app/forms';
	let { form } = $props();
	let submitting = $state(false);
</script>

<main class="grid min-h-dvh place-items-center px-4">
	<div class="card w-full max-w-sm p-6">
		<p class="text-sm font-semibold tracking-wide text-accent">MYCMO</p>
		<h1 class="mt-1 text-2xl font-semibold">Sign in</h1>

		{#if form?.sent}
			<p class="mt-4 text-ink-2">Check <strong class="text-ink">{form.email}</strong> for a sign-in link.</p>
		{:else}
			<form
				method="POST"
				class="mt-6 space-y-4"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update();
						submitting = false;
					};
				}}
			>
				<div>
					<label class="label" for="email">Work email</label>
					<input class="input" id="email" name="email" type="email" autocomplete="email" required value={form?.email ?? ''} />
				</div>
				{#if form?.error}<p class="text-sm text-bad">{form.error}</p>{/if}
				<button class="btn-primary w-full" disabled={submitting}>{submitting ? 'Sending…' : 'Email me a link'}</button>
			</form>
		{/if}
	</div>
</main>
