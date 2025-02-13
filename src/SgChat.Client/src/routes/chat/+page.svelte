<script lang="ts">
	import { goto } from "$app/navigation";
	import { CurrentUser } from "$lib/auth";
    import { ChatHubClient, Messages, ConnectedUsers } from "$lib/signalr/chatHub";
	import { onMount } from "svelte";

    if ($CurrentUser === null) {
        goto("/auth/login");
    }

    const client = new ChatHubClient();
    let connected = $state(false);

    let message = $state("");
    let sending = $state(false);

    onMount(async () => {
        await client.connect();
        connected = true;
    });

    const sendMessage = async () => {
        if (sending) {
            return;
        }

        
        // sending = true;
        await client.sendMessage(message);

        message = "";
        sending = false;
    }
</script>

<main>
    {#if !connected}
    
    <p>Connecting...</p>
    
    {:else}

    <div>
        <span>Connected users: </span>
        {#each $ConnectedUsers as user, i (user.id)}

        {#if i > 0},{/if}
        <span>{user.username}</span>

        {/each}
    </div>
    
    <ul>
        {#each $Messages as message (message.id)}
        <li id={message.id}>
            <span>{message.user.username}: </span>
            <span>{message.message}</span>
        </li>
        {/each}    
    </ul>

    <div>
        <input type="text" disabled={sending} bind:value={message} />
        <button onclick={sendMessage} disabled={sending}>Send</button>
    </div>
    
    {/if}
</main>