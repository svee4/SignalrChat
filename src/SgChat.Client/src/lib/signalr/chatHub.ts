import * as Sg from "@microsoft/signalr";
import { readable, writable, derived, readonly, get } from "svelte/store";
import type { Message, Room, User } from "$lib/signalr/types";
import { AccessToken } from "$lib/auth";
import { ApiRoute } from "$lib/constants";
import createLogger, { Logger } from "$lib/logger";
import { assert, assertNotNullish, TimeoutError } from "$lib/helpers";
import { type ChatHubMessage, type ChatHubRoom, type IChatHubClient, type IChatHubServer, type OpenRoomResponse, type RoomId, type UserId } from "./interop";


const roomsStore = writable<(Room & { joined: boolean })[]>([]);
const joinedRoomsStore = derived(roomsStore, arr => arr.filter(room => room.joined));
const availableRoomsStore = derived(roomsStore, arr => arr.filter(room => !room.joined));
const currentRoomUsersStore = writable<User[] | null>(null);
const currentRoomConnectedUsersStore = writable<User[] | null>(null);
const currentRoomMessagesStore = writable<Message[] | null>(null);

// yes you have to assign these to a variable in order ot export them under a different name
const _readonly_roomsStore = readonly(roomsStore);
const _readonly_joinedRoomsStore = readonly(joinedRoomsStore);
const _readonly_availableRoomsStore = readonly(availableRoomsStore);
const _readonly_currentRoomUsersStore = readonly(currentRoomUsersStore);
const _readonly_currentRoomConnectedUsersStore = readonly(currentRoomConnectedUsersStore);
const _readonly_currentRoomMessagesStore = readonly(currentRoomMessagesStore);

export {
    _readonly_roomsStore as                     Rooms,
    _readonly_joinedRoomsStore as               JoinedRooms,
    _readonly_availableRoomsStore as            AvailableRooms,
    _readonly_currentRoomUsersStore as          CurrentRoomUsers,
    _readonly_currentRoomConnectedUsersStore as CurrentRoomConnectedUsers,
    _readonly_currentRoomMessagesStore as       CurrentRoomMessages
};

const getUserById = (id: string): User => {
    const roomUsers = get(currentRoomUsersStore);
    if (roomUsers === null) {
        throw new Error("Not connected");
    }

    const user = roomUsers.find(user => user.id == id);
    
    if (user === undefined) {
        throw new Error("No such user");
    }

    return user;
}

const getRoomById = (id: RoomId): Room => {
    const rooms = get(joinedRoomsStore);

    const room = rooms.find(room => room.id == id);
    
    if (room === undefined) {
        throw new Error("No such room");
    }

    return room;
}

const createWrapTimeoutErrorHelper = (logger: Logger) => {
    return async <T>(promise: Promise<T>): Promise<T> => {
        try {
            return await promise;
        } catch (e) {
            logger.logError(e);
            if (e instanceof Sg.TimeoutError) {
                throw new TimeoutError("SignalR request timed out", { cause: e });
            } else {
                throw e;
            }
        }
    }
}

class HubManager {
    client: ChatHubClient;
    server: ChatHubServer;
    
    connection: Sg.HubConnection | undefined;
    openRoomId: RoomId | undefined;

    #logger = createLogger("Container");
    #wrapTimeout = createWrapTimeoutErrorHelper(this.#logger);

    constructor() {
        this.client = new ChatHubClient(this);
        this.server = new ChatHubServer(this);
    }
    
    async connect() {
        if (this.connection !== undefined) {
            throw new Error("connection already exists");
        }

        const con = new Sg.HubConnectionBuilder()
            .withUrl(ApiRoute + "/hub/chat", {
                withCredentials: false,
                accessTokenFactory: () => assertNotNullish(get(AccessToken), "token")
            })
            .build();

        con.serverTimeoutInMilliseconds = 10 * 1000;
        
        this.client.registerHandlers(con);

        this.connection = con;

        this.#logger.logInfo("Starting connection", con);
        await this.#wrapTimeout(con.start());
    }

    async disconnect() {
        if (this.connection === undefined) {
            return;
        }

        this.#logger.logInfo("Stopping connection");
        await this.#wrapTimeout(this.connection.stop());
        this.connection = undefined;
    }

    getConnection(): Sg.HubConnection {
        return assertNotNullish(this.connection, "Client not connected");
    }

    getOpenRoomId(): RoomId {
        return assertNotNullish(this.openRoomId, "No room opened");
    }

    ensureRoomOpen() {
        const discard = this.getOpenRoomId();
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
        this.#manager.ensureRoomOpen();
        this.#logger.logDebug("messageReceived", message);

        const { id, userId, roomId, content } = message;
        
        // TODO: notifications for messages in rooms that are joined but not currently opened
        if (roomId !== this.#manager.openRoomId) {
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
        this.#logger.logDebug("userJoined", userId, roomId, username);
        // no op - this app doesnt track room users, only connected users when we are also connected
    }

    async userLeftRoom(userId: UserId, roomId: RoomId) {
        this.#logger.logDebug("userLeft", userId, roomId);
        // no op
    }

    async userOpenedRoom(userId: UserId, roomId: RoomId) {
        // roomId is unused: this app supports only one room open at a time
        this.#manager.ensureRoomOpen();
        currentRoomConnectedUsersStore.update(arr => [...assertNotNullish(arr), { id: userId, username: getUserById(userId).username }]);
    }

	async userClosedRoom(userId: UserId, roomId: RoomId) {
        // roomId is unused: this app supports only one room open at a time
        this.#manager.ensureRoomOpen();
        currentRoomConnectedUsersStore.update(arr => assertNotNullish(arr).filter(user => user.id !== userId));
    }
}

// chathub rpc server proxy
class ChatHubServer implements IChatHubServer {

    #manager: HubManager;
    #logger = createLogger("ChatHubServer");
    #wrapTimeout = createWrapTimeoutErrorHelper(this.#logger);

    constructor(container: HubManager) {
        this.#manager = container;
    }

    async #invoke<T>(method: string, ...args: any[]): Promise<T> {
        const connection = this.#manager.getConnection();
        const result = await this.#wrapTimeout(connection.invoke(method, ...args)) as T;
        this.#logger.logDebug("invoked", method, args, result);
        return result;
    }

    async #send(method: string, ...args: any[]): Promise<void> {
        const connection = this.#manager.getConnection();
        await this.#wrapTimeout(connection.send(method, ...args));
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
        return await this.#invoke("OpenRoom", roomId);
    }

    async closeRoom(roomId: RoomId) {
        await this.#invoke("CloseRoom", roomId);
    }
}


// exposes the api for this app usage - not the exact api 
export class ChatHub {

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
        return this.#manager.connection !== undefined;
    }

    async connect() {
        await this.#manager.connect();
    }

    async disconnect() {
        await this.#manager.disconnect();
    }

    async sendMessage(content: string) {
        await this.#server.sendMessage(this.#manager.getOpenRoomId(), content);
    }

    async createRoom(name: string) {
        await this.#server.createRoom(name);
    }

    async joinRoom(roomId: RoomId) {
        const room = get(availableRoomsStore).find(room => room.id == roomId);
        await this.#server.joinRoom(roomId);
        roomsStore.update(arr => arr.map(room => room.id !== roomId ? room : { ...room, joined: true }));
    }

    async leaveRoom(roomId: RoomId) {
        await this.#server.leaveRoom(roomId);
        roomsStore.update(arr => arr.map(room => room.id !== roomId ? room : { ...room, joined: false }));
    }

    async openRoom(roomId: RoomId) {
        const room = await this.#server.openRoom(roomId);

        currentRoomUsersStore.set(room.allUsers);
        currentRoomConnectedUsersStore.set(room.connectedUsers);

        const msgs = room.messages.map(msg => ({ 
            id: msg.id,
            user: getUserById(msg.userId),
            room: getRoomById(msg.roomId),
            content: msg.content
        }));

        currentRoomMessagesStore.set(msgs);
        
        this.#manager.openRoomId = roomId;
    }

    async closeRoom() {
        const roomId = this.#manager.getOpenRoomId();
        await this.#server.closeRoom(roomId);

        currentRoomUsersStore.set(null);
        currentRoomConnectedUsersStore.set(null);
        currentRoomMessagesStore.set(null);

        this.#manager.openRoomId = undefined;
    }
}

export const Hub = new ChatHub();
