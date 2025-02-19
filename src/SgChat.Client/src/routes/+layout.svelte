<script>
    import { Hub, Connected } from "$lib/signalr/chatHub";
	import { get } from "svelte/store";
    import "../base.css";

    const reconnect = async () => {
        await Hub.connectIfNotConnected();
    }

    const onBeforeUnload = () => {
        if (get(Connected)) {
            Hub.disconnect();
        }

        return false;
    }
</script>

<svelte:window onbeforeunload={onBeforeUnload}></svelte:window>

<header id="header">
    SignalR chat app

    <div>
        <button onclick={reconnect} disabled={$Connected}>Reconnect</button>
    </div>
</header>

<main id="main">
    <slot />
</main>

<style>

    #header {
        display: flex;
        gap: 12px;
        justify-content: center;
        align-items: center;
        
        padding-top: 6px;
        padding-bottom: 6px;

        background-color: rgb(252, 252, 252);
    }
    
    #main {
        padding: 12px;

        height: 100%;
        display: flex;
        flex-direction: column;
    }
</style>