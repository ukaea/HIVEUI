<script>
	import AuthLayout from '$lib/layouts/Auth.svelte';
	import AppLayout from '$lib/layouts/App.svelte';
	import { authClient } from '$lib/auth-client';

	const session = authClient.useSession();
</script>

{#if $session.data}
	<AppLayout>
		<slot />
	</AppLayout>
{:else}
	<AuthLayout>
		<slot />
	</AuthLayout>
{/if}
