<script lang="ts">
	import { AppBar, AppLayout, NavItem, Button, settings } from 'svelte-ux';
	import '../app.postcss';
	import User from '../components/user.svelte';
	import type { LayoutServerData } from './$types';
	import { page } from '$app/stores';
	import { mdiBookOpenVariantOutline, mdiMagnify, mdiPulse, mdiContentSaveCog } from '@mdi/js';
	import { triggerDAG } from '$lib/triggerPipeline';
	import { PUBLIC_AIRFLOW_DIRECTORY, PUBLIC_AIRFLOW_INPUT_FILE } from '$env/static/public';

	async function handleTrigger() {
		const { result, error } = await triggerDAG(PUBLIC_AIRFLOW_DIRECTORY, PUBLIC_AIRFLOW_INPUT_FILE);
	}

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
			<Button variant="fill" on:click={handleTrigger} class="mr-4">Trigger Pipeline</Button>
			<User data={{ user: data?.session?.user ?? undefined, status: Boolean(data?.session) }} />
		</div>
	</AppBar>

	<svelte:fragment slot="nav">
		<NavItem text="Experiment" currentUrl={$page.url} path="/experiment" icon={mdiBookOpenVariantOutline} class="mb-2 ml-3 mt-3 hover:bg-gray-700 transition-colors duration-200" classes={{ active: 'bg-surface-300 text-primary-500' }} />
		<NavItem text="Diagnostic" currentUrl={$page.url} path="/diagnostic" icon={mdiMagnify} class="mb-2 ml-3 hover:bg-gray-700 transition-colors duration-200" classes={{ active: 'bg-surface-300 text-primary-500' }} />
		<NavItem text="Configuration" currentUrl={$page.url} path="/configuration" icon={mdiContentSaveCog} class="mb-2 ml-3 hover:bg-gray-700 transition-colors duration-200" classes={{ active: 'bg-surface-300 text-primary-500' }} />
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
