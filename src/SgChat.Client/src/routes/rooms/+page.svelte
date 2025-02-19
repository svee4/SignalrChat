<script lang="ts">
	import { HubError, wrapHubError } from '$lib/helpers';
	import { Rooms, JoinedRooms, AvailableRooms, Connected, Hub } from '$lib/signalr/chatHub';
	import { ErrorCode, type RoomId } from '$lib/signalr/interop';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';

	onMount(async () => {
		await Hub.connectIfNotConnected();
	});

	const leaveRoom = async (roomId: RoomId) => {
		await Hub.leaveRoom(roomId);
	};

	const joinRoom = async (roomId: RoomId) => {
		await Hub.joinRoom(roomId);
	};

	const createRoom = async () => {
		const roomName = prompt('Room name:');
		if (!roomName) return;

        if (get(Rooms).findIndex(room => room.name == roomName) > -1) {
            alert("Room with that name already exists!");
            return;
        }

        await Hub.createRoom(roomName);
	};
</script>

<div id="page-main">
	{#if !$Connected}
		<p>Connecting...</p>
	{:else}
		<div id="rooms-container">

            <div id="rooms">

                <div class="room-list-container">
                    <p>Joined rooms</p>

                    <div class="room-list">
                        {#each $JoinedRooms as room (room.id)}
                        <div class="room">
                            <p>{room.name}</p>

                            <!-- preloading this route would result in an error as a room hasnt been opened yet-->
                            <a href="/room/{room.id}/chat" data-sveltekit-preload-data="tap">
                                Open chat
                            </a>

                            <button onclick={() => leaveRoom(room.id)}>Leave</button>
                        </div>
                        {:else}
                        <div>
                            <p>No joined rooms! Start by joining one.</p>
                        </div>
                        {/each}
                    </div>
                </div>

                <div id="separator"></div>
                
                <div class="room-list-container">

                    <div style="display: flex; gap: 12px; align-items: center;">
                        <p>Available rooms</p>
                        <button onclick={createRoom} style="align-self: flex-start">Create room</button>
                    </div>

                    <div class="room-list">

                        {#each $AvailableRooms as room (room.id)}
                        <div class="room">
                            <p>{room.name}</p>
                            <button onclick={() => joinRoom(room.id)}>Join</button>
                        </div>
                        {:else}
                        <div>
                            <p>No available rooms! Start by creating one.</p>
                        </div>
                        {/each}
                    </div>
                </div>
            </div>
		</div>
	{/if}
</div>

<style>
    #rooms-container {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    #rooms {
        display: grid;
        grid-template-columns: 1fr 1px 1fr;
        gap: 6px;
    }

    #separator {
        background-color: black;
    }

    .room-list-container {
        padding: 2px;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .room-list {
        border-top: 1px solid gray;
        padding: 6px;

        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .room {
        display: flex;
        gap: 8px;
        align-items: center;

        padding: 6px;
        padding-left: 8px;
        border: 1px solid gray;
        border-radius: 4px;
    }

    .room:nth-child(2n) {
        background-color: rgb(252, 252, 252);
    }

</style>