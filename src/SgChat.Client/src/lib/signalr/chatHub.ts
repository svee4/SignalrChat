import * as Sg from "@microsoft/signalr";
import { readable, writable, derived, readonly, get } from "svelte/store";
import type { Message, Room, User } from "$lib/signalr/types";
import { AccessToken } from "$lib/auth";
import { ApiRoute } from "$lib/constants";
import createLogger, { Logger } from "$lib/logger";
import { assert, assertNotNullish, TimeoutError, wrapHubError } from "$lib/helpers";
import { type ChatHubMessage, type ChatHubRoom, type IChatHubClient, type IChatHubServer, type OpenRoomResponse, type RoomId, type UserId } from "./interop";

const connectedStore = writable<boolean>(false);
const roomsStore = writable<(Room & { joined: boolean })[]>([]);
const joinedRoomsStore = derived(roomsStore, arr => arr.filter(room => room.joined));
const availableRoomsStore = derived(roomsStore, arr => arr.filter(room => !room.joined));

const currentRoomStore = writable<{ name: string } | null>(null);
const currentRoomUsersStore = writable<User[] | null>(null);
const currentRoomConnectedUsersStore = writable<User[] | null>(null);
const currentRoomMessagesStore = writable<Message[] | null>(null);

// yes you have to assign these to a variable in order to export them under a different name
// its ugly but it works
const _readonly_connectedStore = readonly(connectedStore);
const _readonly_roomsStore = readonly(roomsStore);
const _readonly_joinedRoomsStore = readonly(joinedRoomsStore);
const _readonly_availableRoomsStore = readonly(availableRoomsStore);

const _readonly_currentRoom = readonly(currentRoomStore);
const _readonly_currentRoomUsersStore = readonly(currentRoomUsersStore);
const _readonly_currentRoomConnectedUsersStore = readonly(currentRoomConnectedUsersStore);
const _readonly_currentRoomMessagesStore = readonly(currentRoomMessagesStore);

export {
    _readonly_connectedStore as                 Connected,
    _readonly_roomsStore as                     Rooms,
    _readonly_joinedRoomsStore as               JoinedRooms,
    _readonly_availableRoomsStore as            AvailableRooms,

    _readonly_currentRoom as                    CurrentRoom,
    _readonly_currentRoomUsersStore as          CurrentRoomUsers,
    _readonly_currentRoomConnectedUsersStore as CurrentRoomConnectedUsers,
    _readonly_currentRoomMessagesStore as       CurrentRoomMessages
};

const getUserById = (id: string): User => {
    assert(get(currentRoomStore) !== null, "Not in a room");

    const roomUsers = assertNotNullish(get(currentRoomUsersStore), "currentRoomUsersStore should not be null");
    const user = roomUsers!.find(user => user.id == id);
    
    if (user === undefined) {
        throw new Error("No such user");
    }

    return user;
}

const getRoomById = (id: RoomId): Room => {
    const rooms = get(roomsStore);
    const room = rooms.find(room => room.id == id);
    
    if (room === undefined) {
        throw new Error("No such room");
    }

    return room;
}

const wrapTimeoutError = async <T>(promise: Promise<T>): Promise<T> => {
    try {
        return await promise;
    } catch (e) {
        if (e instanceof Sg.TimeoutError) {
            throw new TimeoutError("SignalR request timed out", { cause: e });
        } else {
            throw e;
        }
    }
}

class HubManager {
    client: ChatHubClient;
    server: ChatHubServer;
    
    connection: Sg.HubConnection;
    roomId: RoomId | undefined;

    #logger = createLogger("HubManager");

    constructor() {
        this.client = new ChatHubClient(this);
        this.server = new ChatHubServer(this);

        const con = new Sg.HubConnectionBuilder()
            .withUrl(ApiRoute + "/hub/chat", {
                withCredentials: false,
                accessTokenFactory: () => assertNotNullish(get(AccessToken), "token")
            })
            .build();

        con.serverTimeoutInMilliseconds = 10 * 1000;
        
        this.client.registerHandlers(con);

        con.onclose(async err => { 
            this.#logger.logDebug("onclose", err); 
            connectedStore.set(false);
            await this.connect();
        });
        
        con.onreconnecting(() => connectedStore.set(false));
        con.onreconnected(() => connectedStore.set(true));

        this.connection = con;
    }
    
    async connect() {
        assert(this.connection.state === Sg.HubConnectionState.Disconnected, "Connection state must be 'Disconnected'");

        this.#logger.logInfo("Starting connection", this.connection);
        await wrapTimeoutError(this.connection.start());
        connectedStore.set(true); // i dont see an event on Sg.Connection for this sadly
    }

    async disconnect() {
        assert(this.connection.state === Sg.HubConnectionState.Connected, "Connection state must be 'Connected'");

        this.#logger.logInfo("Stopping connection");
        await wrapTimeoutError(this.connection.stop());
        // onclose event listener handles setting connectionStore
    }

    getConnectedConnection(): Sg.HubConnection {
        assert(this.connection.state === Sg.HubConnectionState.Connected, "Connection not connected");
        return this.connection;
    }

    getRoomId(): RoomId {
        return assertNotNullish(this.roomId, "No room opened");
    }

    ensureRoomOpen() {
        const discard = this.getRoomId();
    }
}

// actual chathub rpc client
class ChatHubClient implements IChatHubClient {

    #manager: HubManager;
    #logger = createLogger("ChatHubClient");

    constructor(container: HubManager){
        this.#manager = container;
    }

    registerHandlers(con: Sg.HubConnection) {
        con.on("OnConnected", this.onConnected.bind(this));
        con.on("MessageReceived", this.messageReceived.bind(this));
        con.on("RoomCreated", this.roomCreated.bind(this));
        con.on("UserJoinedRoom", this.userJoinedRoom.bind(this));
        con.on("UserLeftRoom", this.userLeftRoom.bind(this));
        con.on("UserOpenedRoom", this.userOpenedRoom.bind(this));
        con.on("UserClosedRoom", this.userClosedRoom.bind(this));
    }

    // interface methods

    async onConnected(joinedRooms: ChatHubRoom[], availableRooms: ChatHubRoom[]): Promise<void> {
        this.#logger.logDebug("onConnected", joinedRooms, availableRooms);
        roomsStore.set([
            ...joinedRooms.map(room => ({...room, joined: true})),
            ...availableRooms.map(room => ({...room, joined: false})),
        ]);
    }

    async messageReceived(message: ChatHubMessage) {
        this.#logger.logDebug("messageReceived", message);
        this.#manager.ensureRoomOpen();

        const { id, userId, roomId, content } = message;
        
        // TODO: notifications for messages in rooms that are joined but not currently opened
        if (roomId !== this.#manager.roomId) {
            return;
        }

        currentRoomMessagesStore.update(arr => [...arr!, { id, user: getUserById(userId), room: getRoomById(roomId), content }]);
    }

    async roomCreated(room: ChatHubRoom): Promise<void> {
        this.#logger.logDebug("roomCreated", room);
        const { id, name } = room;
        roomsStore.update(arr => [...arr, { id, name, joined: false }]);
    }

    async userJoinedRoom(userId: UserId, roomId: RoomId, username: string) {
        this.#logger.logDebug("userJoinedRoom", userId, roomId, username);
        // no op - this app doesnt track users of closed rooms
        // we only track user activity in the room that is currently open
    }

    async userLeftRoom(userId: UserId, roomId: RoomId) {
        this.#logger.logDebug("userLeftRoom", userId, roomId);
        // no op - see above
    }

    async userOpenedRoom(userId: UserId, roomId: RoomId) {
        this.#logger.logDebug("userOpenedroom", userId, roomId);

        const myRoomId = this.#manager.getRoomId();
        assert(roomId === myRoomId, "roomId === myRoomId");

        currentRoomConnectedUsersStore.update(arr => [...assertNotNullish(arr), { id: userId, username: getUserById(userId).username }]);
    }

	async userClosedRoom(userId: UserId, roomId: RoomId) {
        this.#logger.logDebug("userClosedRoom", userId, roomId);

        const myRoomId = this.#manager.getRoomId();
        assert(roomId === myRoomId, "roomId === myRoomId");

        this.#manager.ensureRoomOpen();
        currentRoomConnectedUsersStore.update(arr => assertNotNullish(arr).filter(user => user.id !== userId));
    }
}

// chathub rpc server proxy
class ChatHubServer implements IChatHubServer {

    #manager: HubManager;
    #logger = createLogger("ChatHubServer");

    constructor(container: HubManager) {
        this.#manager = container;
    }

    async #invoke<T>(method: string, ...args: any[]): Promise<T> {
        const connection = this.#manager.getConnectedConnection();
        const result = await wrapHubError(wrapTimeoutError(connection.invoke(method, ...args))) as T;
        this.#logger.logDebug("invoked", method, args, result);
        return result;
    }

    async #send(method: string, ...args: any[]): Promise<void> {
        const connection = this.#manager.getConnectedConnection();
        await wrapHubError(wrapTimeoutError(connection.send(method, ...args)));
        this.#logger.logDebug("sent", method, args)
    }

    // interface implementation

    async sendMessage(roomId: RoomId, content: string) {
        await this.#invoke("SendMessage", roomId, content);
    }

    async createRoom(name: string) {
        await this.#invoke("CreateRoom", name);
    }

    async joinRoom(roomId: RoomId) {
        await this.#invoke("JoinRoom", roomId);
    }

    async leaveRoom(roomId: RoomId) {
        await this.#invoke("LeaveRoom", roomId);
    }

    async openRoom(roomId: RoomId): Promise<OpenRoomResponse> {
        return await this.#invoke<OpenRoomResponse>("OpenRoom", roomId);
    }

    async closeRoom(roomId: RoomId) {
        await this.#invoke("CloseRoom", roomId);
    }
}

// exposes the api for this app usage
class ChatHub {
    #manager: HubManager;

    constructor() {
        this.#manager = new HubManager();
        this.#manager.client = new ChatHubClient(this.#manager);
        this.#manager.server = new ChatHubServer(this.#manager);
    }

    get #client() {
        return this.#manager.client;
    }

    get #server() {
        return this.#manager.server;
    }

    get connected() {
        return get(connectedStore);
    }

    async connectIfNotConnected() {
        if (this.#manager.connection.state === Sg.HubConnectionState.Disconnected) {
            await this.connect();
        }
    }

    async connect() {
        await this.#manager.connect();
    }

    async disconnect() {
        await this.#manager.disconnect();
    }

    async sendMessage(content: string) {
        await this.#server.sendMessage(this.#manager.getRoomId(), content);
    }

    async createRoom(name: string) {
        await this.#server.createRoom(name);
    }

    async joinRoom(roomId: RoomId) {
        await this.#server.joinRoom(roomId);
        roomsStore.update(arr => {
            // move room to be last
            const roomIndex = arr.findIndex(room => room.id === roomId);
            const room = arr[roomIndex];
            arr.splice(roomIndex, 1);
            room.joined = true;
            arr.push(room);
            return arr;
        });
    }

    async leaveRoom(roomId: RoomId) {
        await this.#server.leaveRoom(roomId);
        roomsStore.update(arr => {
            // move room to be last
            const roomIndex = arr.findIndex(room => room.id === roomId);
            const room = arr[roomIndex];
            arr.splice(roomIndex, 1);
            room.joined = false;
            arr.push(room);
            return arr;
        });    
    }

    async openRoom(roomId: RoomId) {
        const room = await this.#server.openRoom(roomId);

        currentRoomStore.set({ name: getRoomById(roomId).name });
        currentRoomUsersStore.set(room.allUsers);
        currentRoomConnectedUsersStore.set(room.connectedUsers);

        const msgs = room.messages.map(msg => ({ 
            id: msg.id,
            user: getUserById(msg.userId),
            room: getRoomById(msg.roomId),
            content: msg.content
        }));

        currentRoomMessagesStore.set(msgs);
        
        this.#manager.roomId = roomId;
    }

    async closeRoom() {
        const roomId = this.#manager.getRoomId();
        await this.#server.closeRoom(roomId);

        currentRoomUsersStore.set(null);
        currentRoomConnectedUsersStore.set(null);
        currentRoomMessagesStore.set(null);

        this.#manager.roomId = undefined;
    }
}

export const Hub = new ChatHub();
