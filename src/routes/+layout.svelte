<script lang="ts">
	import { AppBar, AppLayout, NavItem, settings } from 'svelte-ux';
	import '../app.postcss';
	import User from '../components/user.svelte';
	import type { LayoutServerData } from './$types';
	import { page } from '$app/stores';
	import { mdiBookOpenVariantOutline, mdiMagnify, mdiPulse } from '@mdi/js';

	export let data: LayoutServerData;

	settings({
		components: {
			AppBar: {
				classes: 'bg-custom-blue text-white shadow-md'
			}
		}
	});

	let navWidth = 265; // Set a fixed width for the navigation sidebar
	let isNavOpen = true; // Keep the sidebar open by default
</script>

<AppLayout {navWidth} navOpen={isNavOpen}>
	<AppBar class="main-appbar">
		<svelte:fragment slot="title">
			<a href="/" class="flex items-center text-white hover:text-gray-200 transition-colors duration-200">
				<span class="text-2xl font-semibold">HIVE Data Ingestion</span>
			</a>
		</svelte:fragment>
		<div slot="actions" class="flex items-center justify-end w-full">
			<User data={{ user: data?.session?.user ?? undefined, status: Boolean(data?.session) }} />
		</div>
	</AppBar>

	<svelte:fragment slot="nav">
		<NavItem text="Experiment" currentUrl={$page.url} path="/experiment" icon={mdiBookOpenVariantOutline} class="mb-2 ml-3 mt-3 hover:bg-gray-700 transition-colors duration-200" classes={{ active: 'bg-surface-300 text-primary-500' }} />
		<NavItem text="Diagnostic" currentUrl={$page.url} path="/diagnostic" icon={mdiMagnify} class="mb-2 ml-3 hover:bg-gray-700 transition-colors duration-200" classes={{ active: 'bg-surface-300 text-primary-500' }} />
		<NavItem text="Pulse" currentUrl={$page.url} path="/pulse" icon={mdiPulse} class="mb-2 ml-3 hover:bg-gray-700 transition-colors duration-200" classes={{ active: 'bg-surface-300 text-primary-500' }} />
	</svelte:fragment>

	<main>
		<slot />
	</main>
</AppLayout>

<style>
	:global(.main-appbar) {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0 0rem;
	}

	:global(.main-appbar h2) {
		margin-right: auto;
	}

	:global(.main-appbar [slot='actions']) {
		margin-left: auto;
	}

	:global(.nav) {
		border-right: 2px solid white;
	}
</style>
