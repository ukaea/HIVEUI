<script lang="ts">
    import { Button } from 'svelte-ux';
    import { authClient } from '$lib/auth-client';

    async function signIn() {
        await authClient.signIn.social({
            provider: "keycloak-custom",
        });
    }
</script>

<main class="p-2 grid place-items-center content-center">
    <div class="text-center">
        <h1 class="mb-8 text-3xl font-bold text-white">HIVE Data Ingestion</h1>
        
        <Button 
            variant="fill" 
            class="px-8 py-3 text-lg font-semibold text-custom-blue shadow-lg hover:bg-gray-100"
            on:click={signIn}
        >
            Sign In
        </Button>
    </div>
</main>