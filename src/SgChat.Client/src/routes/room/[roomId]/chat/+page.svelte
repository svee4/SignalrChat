<script lang="ts">
	import { timeout, TimeoutError } from "$lib/helpers";
    import { Hub, CurrentRoomConnectedUsers, CurrentRoomMessages } from "$lib/signalr/chatHub";
	import type { PageData, PageLoad, PageProps } from "./$types";

    const { data }: PageProps = $props();
    const roomId = data.roomId;

    let message = $state("");
    let sending = $state(false);

    const onBeforeUnload = () => {
        Hub.disconnect();
        return false;
    }

    const sendMessage = async () => {
        if (sending) {
            return;
        }

        sending = true;
        try {
            await timeout(Hub.sendMessage(message), 5000);
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
    <a href="/rooms">Close</a>

    <div>
        <span>Connected users: </span>
        {#each $CurrentRoomConnectedUsers! as user, i (user.id)}

        {#if i > 0},{/if}
        <span>{user.username}</span>

        {/each}
    </div>
    
    <ul>
        {#each $CurrentRoomMessages! as message (message.id)}
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
</main>