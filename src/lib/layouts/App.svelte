<script lang="ts">
	import { AppBar, AppLayout, NavItem, Button, settings } from 'svelte-ux';
	import '../../app.postcss';
	import { page } from '$app/stores';
	import { mdiBookOpenVariantOutline, mdiMagnify, mdiPulse, mdiContentSaveCog, mdiGroup } from '@mdi/js';
	import LoggedInUser from '$lib/components/LoggedInUser.svelte';

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
		<!-- 	<Button variant="fill" on:click={handleTrigger} class="mr-4">Trigger Pipeline</Button>  -->
			<LoggedInUser />
		</div>
	</AppBar>

	<svelte:fragment slot="nav">
		<NavItem text="Experiments" currentUrl={$page.url} path="/experiments" icon={mdiBookOpenVariantOutline} class="mb-2 ml-3 mt-3 hover:bg-gray-700 transition-colors duration-200" classes={{ active: 'bg-surface-300 text-primary-500' }} />
		<NavItem text="Equipment" currentUrl={$page.url} path="/equipment" icon={mdiMagnify} class="mb-2 ml-3 hover:bg-gray-700 transition-colors duration-200" classes={{ active: 'bg-surface-300 text-primary-500' }} />
		<NavItem text="Configuration" currentUrl={$page.url} path="/configuration" icon={mdiContentSaveCog} class="mb-2 ml-3 hover:bg-gray-700 transition-colors duration-200" classes={{ active: 'bg-surface-300 text-primary-500' }} />
		<NavItem text="Runs" currentUrl={$page.url} path="/run" icon={mdiPulse} class="mb-2 ml-3 hover:bg-gray-700 transition-colors duration-200" classes={{ active: 'bg-surface-300 text-primary-500' }} />
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

	:global(.styled-table) {
		width: 100%;
		border-collapse: collapse;
	}

	:global(.styled-table th) {
		background-color: #2563eb;
		color: white;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.75rem 1.5rem;
		text-align: left;
	}

	:global(.styled-table td) {
		padding: 1rem 1.5rem;
		color: #1f2937;
	}

	:global(.styled-table tr:nth-child(even)) {
		background-color: #f9fafb;
	}

	:global(.styled-table tr:hover) {
		background-color: #f3f4f6;
	}

	:global(.label.group-focus-within\:text-\[var\(--color\)\]) {
		color: rgb(179, 179, 179) !important;
	}
</style>
