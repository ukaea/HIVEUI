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
			idToken?: string;
			accessToken?: string;
			refreshToken?: string;
		};
	}

	export let data: User;

	function stringifyToken(token: string) {
		return JSON.stringify(jwtDecode(token), null, 2);
	}

	let idToken = '';
	let accessToken = '';
	let refreshToken = '';

	onMount(() => {
		if (data && data.user) {
			if (data.user.idToken) idToken = stringifyToken(data.user.idToken);
			if (data.user.accessToken) accessToken = stringifyToken(data.user.accessToken);
			if (data.user.refreshToken) refreshToken = stringifyToken(data.user.refreshToken);
		}
	});
</script>

<div>
	{#if data.status}
		<Toggle let:on={open} let:toggle let:toggleOff>
			<Button variant="fill" size="lg" on:click={toggle}>
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