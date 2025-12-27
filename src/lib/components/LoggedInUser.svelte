<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { Button, Menu, MenuItem, Toggle } from 'svelte-ux';

	const session = authClient.useSession();

	async function signIn() {
		await authClient.signIn.social({
			provider: 'keycloak-custom'
		});
	}

	async function signOut() {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
                    window.location.href = '/login';
				}
			}
		});
	}

</script>

<div>
	{#if $session.data}
		<Toggle let:on={open} let:toggle let:toggleOff>
			<Button variant="fill" on:click={toggle} class="mr-4">
				{$session.data.user?.name ?? 'User'}
			</Button>

			<Menu {open} on:close={toggleOff} matchWidth>
				<MenuItem>
					<Button variant="text" on:click={signOut} fullWidth>Sign Out</Button>
				</MenuItem>
			</Menu>
		</Toggle>
	{:else}
		<div>
			<Button variant="fill" on:click={signIn}>Sign In</Button>
		</div>
	{/if}
</div>
