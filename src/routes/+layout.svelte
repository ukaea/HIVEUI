<script>
	import AppLayout from '$lib/layouts/App.svelte';
	import { authClient } from '$lib/auth-client';

	const session = authClient.useSession();
</script>


<AppLayout>
	<slot />
</AppLayout>
