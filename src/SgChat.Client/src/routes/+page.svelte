<script lang="ts">
    import { isLoggedIn } from "$lib/auth";
</script>

<div id="page-main">
    {#if isLoggedIn() }
    
    <a href="/chat">Chat</a>
    <a href="/auth/logout">Log out</a>
    
    {:else}
    
    <a href="/auth/login">Log in</a>
    
    {/if}
</div>

<style>
    #page-main {
        display: flex;
        align-items: center;
    }
</style>