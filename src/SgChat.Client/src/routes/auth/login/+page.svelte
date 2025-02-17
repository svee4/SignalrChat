<script lang="ts">
	import { goto } from "$app/navigation";
    import { login } from "$lib/auth";
	import { Hub } from "$lib/signalr/chatHub";
    
    let username = $state("");
    let inProgress = $state(false);

    const loginClick = async () => {
        inProgress = true;
        const success = await login(username);

        if (success) {
            await Hub.connect();
            await goto("/rooms");
        }

        inProgress = false;
    }
</script>

<main>
    <label for="username">Username</label>
    <input type="text" bind:value={username} name="username" id="username" />
    <button onclick={loginClick} disabled={inProgress}>Log in</button>
</main>