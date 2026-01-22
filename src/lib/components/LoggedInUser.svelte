<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { Button, Menu, MenuItem, Toggle } from 'svelte-ux';

	const session = authClient.useSession();

	function signIn() {
		window.location.href = '/';
	}

	function signOut() {
		// Points to our new route at /signout
		window.location.href = '/signout';
	}
</script>

<div>
	{#if $session.data}
		<Toggle let:on={open} let:toggle let:toggleOff>
			<Button variant="fill" on:click={toggle} class="mr-4">
				{$session.data.user?.name ?? 'User'}
			</Button>

			<Menu {open} on:close={toggleOff} placement="bottom-start" matchWidth>
				<MenuItem on:click={signOut}>
					<span class="w-full text-left">Sign Out</span>
				</MenuItem>
			</Menu>
		</Toggle>
	{:else}
		<div>
			<Button variant="fill" on:click={signIn}>Sign In</Button>
		</div>
	{/if}
</div>
