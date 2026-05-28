<script>
	import AppLayout from '$lib/layouts/App.svelte';
	import { onMount } from 'svelte';

	// Intercept all fetch calls made by SvelteKit's client router and reload
	// the page if the server signals that the session has expired (401 + x-auth-reload).
	onMount(() => {
		const original = window.fetch;
		window.fetch = async (...args) => {
			const response = await original(...args);
			if (response.status === 401 && response.headers.get('x-auth-reload') === '1') {
				window.location.reload();
			}
			return response;
		};
		return () => { window.fetch = original; };
	});
</script>

<AppLayout>
	<slot />
</AppLayout>
