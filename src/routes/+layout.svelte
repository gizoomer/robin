<script lang="ts">
	import '../app.css';
	let { data, children } = $props();
</script>

{#if data.demo}
	<div class="flex items-center justify-center gap-3 bg-ink px-4 py-1.5 text-xs text-bg">
		<span>
			Demo mode, sample data{#if data.demo.name}: signed in as <strong>{data.demo.name}</strong>{/if}
		</span>
		<a href="/demo" class="font-semibold underline">Switch user</a>
	</div>
{/if}
{@render children()}
