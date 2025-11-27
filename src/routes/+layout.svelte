<script>
	import AuthLayout from '$lib/layouts/Auth.svelte';
	import AppLayout from '$lib/layouts/App.svelte';
	import { authClient } from '$lib/auth-client';

	const session = authClient.useSession();
</script>

{#if $session.data || $session.isPending}
	<AppLayout>
		<slot />
	</AppLayout>
{:else}
	<AuthLayout>
		<slot />
	</AuthLayout>
{/if}
