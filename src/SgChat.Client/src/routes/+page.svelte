<script lang="ts">
    import { isLoggedIn } from "$lib/auth";
</script>

{#if isLoggedIn() }

<a href="/chat">Chat</a>
<a href="/auth/logout">Log out</a>

{:else}

<a href="/auth/login">Log in</a>

{/if}
