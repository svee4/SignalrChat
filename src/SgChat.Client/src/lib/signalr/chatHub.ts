import * as Sg from "@microsoft/signalr";
import { readable, writable, derived, readonly, get } from "svelte/store";
import type { Message, User } from "$lib/signalr/types";
import { AccessToken } from "$lib/auth";
import { ApiRoute } from "$lib/constants";
import createLogger from "$lib/logger";

// internal interop types, keep in sync with api types 
type ChatHubMessage = {
    id: string;
    userId: string;
    message: string;
};

type ChatHubUser = {
    id: string;
    username: string;
}

interface IChatHubClient {
	selfJoined(connectedUsers: ChatHubUser[], allUsers: ChatHubUser[], messages: ChatHubMessage[]): Promise<void>;
	messageReceived(id: string, userId: string, message: string): Promise<void>;
	userJoined(id: string, username: string): Promise<void>;
	userLeft(id: string): Promise<void>;
}

const messagesStore = writable([] as Message[]);
const connectedUsersStore = writable([] as User[]);
const allUsersStore = writable([] as User[])

export const Messages = readonly(messagesStore);
export const ConnectedUsers = readonly(connectedUsersStore);

export const getUserById = (id: string): User => {
    const user = get(allUsersStore).find(user => user.id == id);
    
    if (user === undefined) {
        throw new Error("No such user");
    }

    if (user === null) {
        throw new Error("User should not be null");
    }

    return user;
}

// only exposes public functions for consumer usage
export class ChatHubClient {

    #impl: ChatHubClientImpl = new ChatHubClientImpl(this);

    async connect() {
        this.#impl.connect();
    }

    async sendMessage(message: string) {
        await this.#impl.sendMessage(message);
    }
}

// exposes the actual chathub rpc implementation, only for internal usage
class ChatHubClientImpl implements IChatHubClient {

    parent: ChatHubClient;
    connection: Sg.HubConnection | undefined;
    logger = createLogger("ChatHubClientImpl");

    constructor(parent: ChatHubClient){
        this.parent = parent;
    }

    ensureConnected() {
        if (this.connection === undefined) {
            throw new Error("Client not connected");
        }
    }

    async invoke<T>(method: string, ...args: any[]): Promise<T> {
        this.ensureConnected();
        const result = await this.connection!.invoke(method, ...args) as T;
        this.logger.logDebug("invoked", method, args, result);
        return result;
    }

    async send(method: string, ...args: any[]): Promise<void> {
        this.ensureConnected();
        await this.connection!.send(method, ...args);
        this.logger.logDebug("sent", method, args)
    }

    async connect() {
        if (this.connection !== undefined) {
            throw new Error("connection already exists");
        }

        const con = new Sg.HubConnectionBuilder()
            .withUrl(ApiRoute + "/hub/chat", {
                withCredentials: false,
                accessTokenFactory: () =>  {
                    // TODO: should this use the store directly, or take the token as a parameter?
                    // using store directly means refreshing the token is very simple,
                    // but its a little messy.
                    const token = get(AccessToken);
                    this.logger.logDebug(token);
                    if (token === null) {
                        throw new Error("Access token is null");
                    }

                    return token;
            }})
            .build();

        
        con.on("SelfJoined", this.selfJoined.bind(this));
        con.on("MessageReceived", this.messageReceived.bind(this));
        con.on("UserJoined", this.userJoined.bind(this));
        con.on("UserLeft", this.userLeft.bind(this));

        this.connection = con;

        this.logger.logInfo("Starting connection");
        await this.connection.start();
    }

    async disconnect() {
        if (this.connection === undefined) {
            return;
        }

        this.logger.logInfo("Stopping connection");
        await this.connection.stop();
        this.connection = undefined;
    }

    async selfJoined(connectedUsers: ChatHubUser[], allUsers: ChatHubUser[], messages: ChatHubMessage[]) {
        this.logger.logDebug("selfJoined", connectedUsers, allUsers, messages);
        connectedUsersStore.set(connectedUsers.map<User>(user => ({ id: user.id, username: user.username })));
        allUsersStore.set(allUsers.map<User>(user => ({ id: user.id, username: user.username })));
        messagesStore.set(messages.map<Message>(msg => ({ id: msg.id, message: msg.message, user: getUserById(msg.userId) })));
    }

    async messageReceived(id: string, userId: string, message: string) {
        this.logger.logDebug("messageReceived", id, userId, message);
        messagesStore.update(arr => [...arr, { id, message, user: getUserById(userId) }]);
        console.log(get(messagesStore));
    }

    async userJoined(id: string, username: string) {
        this.logger.logDebug("userJoined", id, username);
        const user: User = { id, username };

        connectedUsersStore.update(arr => [...arr, user]);

        if (get(allUsersStore).find(user => user.id === id) === undefined) {
            allUsersStore.update(arr => [...arr, user]);
        }
    }

    async userLeft(id: string) {
        this.logger.logDebug("userLeft", id);
        connectedUsersStore.update(arr => [...arr.filter(user => user.id !== id)]);
    }

    async sendMessage(message: string) {
        await this.invoke("SendMessage", message);
    } 
}