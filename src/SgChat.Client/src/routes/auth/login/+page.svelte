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
            Hub.connect();
            await goto("/rooms");
        }

        inProgress = false;
    }
</script>

<div id="page-main">
    <label for="username">Username</label>
    <input type="text" bind:value={username} name="username" id="username" />
    <button onclick={loginClick} disabled={inProgress}>Log in</button>
</div>

<style>
    #page-main {
        align-self: center;
        display: flex;
        flex-direction: column;
        gap: 6px;
        justify-content: center;
        width: min-content;
    }
</style>