<script lang="ts">
	import { Button } from 'svelte-ux';

	function signIn() {
		window.location.href = '/';
	}
</script>

<main class="p-2 grid place-items-center content-center">
	<div class="text-center">
		<h1 class="mb-8 text-3xl font-bold text-white">HIVE Data Ingestion</h1>
		<h1 class="text-3xl font-bold text-red-600">Access Denied</h1>
		<p class="my-4">You do not have the required permissions to view this application.</p>
		<Button
			variant="fill"
			class="px-8 py-3 text-lg font-semibold text-custom-blue shadow-lg hover:bg-gray-100"
			on:click={signIn}
		>
			Sign In
		</Button>
	</div>
</main>
