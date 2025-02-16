<script lang="ts">
	import { timeout, TimeoutError } from "$lib/helpers";
    import { TimeoutError as SgTimeoutError } from "@microsoft/signalr";
    import { ChatHubClient, Messages, ConnectedUsers } from "$lib/signalr/chatHub";
	import { onMount } from "svelte";

    const client = new ChatHubClient();
    let connected = $state(false);

    let message = $state("");
    let sending = $state(false);

    onMount(async () => {
        await client.connect();
        connected = true;
    });

    const onBeforeUnload = () => {
        client.disconnect()
        return false;
    }

    const sendMessage = async () => {
        if (sending) {
            return;
        }

        sending = true;
        try {
            await timeout(client.sendMessage(message), 5000);
        } catch (e) {
            // TODO: proper errorssss to user
            if (e instanceof TimeoutError) {
                alert("Server timed out");
                sending = false;
                return;
            }
        }

        message = "";
        sending = false;
    }
</script>

<svelte:window onbeforeunload={onBeforeUnload}></svelte:window>

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
            <span>{message.content}</span>
        </li>
        {/each}    
    </ul>

    <div>
        <input type="text" disabled={sending} bind:value={message} />
        <button onclick={sendMessage} disabled={sending}>Send</button>
    </div>
    
    {/if}
</main>