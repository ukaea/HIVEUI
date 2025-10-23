<script lang="ts">
	import { Button, Menu, MenuItem, Toggle } from 'svelte-ux';
	import { jwtDecode } from 'jwt-decode';
	import { onMount } from 'svelte';
	import { mdiLogout } from '@mdi/js';
	import { SignIn } from "@auth/sveltekit/components";
	import { SignOut } from "@auth/sveltekit/components";
	
	interface User {
		status: boolean;
		user?: {
			name?: string | null;
			email?: string | null;
		};
	}

	export let data: User;
</script>

<div>
	{#if data.status}
		<Toggle let:on={open} let:toggle let:toggleOff>
			<Button variant="fill" on:click={toggle} class="mr-4">
				{data.user?.name ?? 'User'}
				<Menu {open} on:close={toggleOff} matchWidth>
					<MenuItem>
						<SignOut>
							<span slot="submitButton">Sign Out</span>
						</SignOut>
					</MenuItem>
				</Menu>
			</Button>
		</Toggle>
	{:else}
		<div>
			<SignIn>
				<span slot="submitButton">Sign In</span>
			</SignIn>
		</div>
	{/if}
</div>

<style>
</style>
