<script lang="ts">
	import { page } from '$app/stores';
	import { Button, Menu, MenuItem, Toggle } from 'svelte-ux';

	$: user = $page.data.user;

	function signIn() {
		window.location.href = '/';
	}

	function signOut() {
		window.location.href = '/signout';
	}
</script>

<div>
	{#if user}
		<Toggle let:on={open} let:toggle let:toggleOff>
			<Button variant="fill" on:click={toggle} class="mr-4">
				{user.name ?? 'User'}
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
