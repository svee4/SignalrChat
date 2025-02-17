<script lang="ts">
    import { JoinedRooms, AvailableRooms, Hub } from "$lib/signalr/chatHub";
	import type { RoomId } from "$lib/signalr/interop";

    const leaveRoom = async (roomId: RoomId) => {
        await Hub.leaveRoom(roomId);
    }

    const joinRoom = async (roomId: RoomId) => {
        await Hub.joinRoom(roomId);
    }

    const createRoom = async () => {
        const roomName = prompt("Room name:");
        if (!roomName) return;

        await Hub.createRoom(roomName);
    }
</script>

<main>
    <button onclick={createRoom}>Create room</button>

    <ul>
        {#each $JoinedRooms as room (room.id)}
        <li>
            <a href="/room/{room.id}/chat">{room.name}</a>
            <button onclick={() => leaveRoom(room.id)}>Leave</button>
        </li>
        {/each}
    </ul>

    <ul>
        {#each $AvailableRooms as room (room.id)}
        <li>
            <p>{room.name}</p>
            <button onclick={() => joinRoom(room.id)}>Join</button>
        </li>
        {/each}
    </ul>
</main>