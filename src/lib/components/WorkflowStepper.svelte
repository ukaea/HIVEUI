<script lang="ts">
	export let steps: { label: string; description: string }[] = [];
	export let currentStep: number = 0;
</script>

<div class="flex items-center w-full mb-8">
	{#each steps as step, i}
		<div class="flex items-center {i < steps.length - 1 ? 'flex-1' : ''}">
			<div class="flex flex-col items-center">
				<div
					class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2
						{i < currentStep
							? 'bg-green-500 border-green-500 text-white'
							: i === currentStep
								? 'bg-blue-600 border-blue-600 text-white'
								: 'bg-surface-300 border-gray-500 text-gray-400'}"
				>
					{#if i < currentStep}
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
						</svg>
					{:else}
						{i + 1}
					{/if}
				</div>
				<div class="mt-2 text-center">
					<div class="text-xs font-semibold {i <= currentStep ? 'text-gray-100' : 'text-gray-500'}">
						{step.label}
					</div>
					<div class="text-xs {i <= currentStep ? 'text-gray-300' : 'text-gray-600'}">
						{step.description}
					</div>
				</div>
			</div>
			{#if i < steps.length - 1}
				<div
					class="flex-1 h-0.5 mx-2 mt-[-1.5rem]
						{i < currentStep ? 'bg-green-500' : 'bg-gray-600'}"
				/>
			{/if}
		</div>
	{/each}
</div>
