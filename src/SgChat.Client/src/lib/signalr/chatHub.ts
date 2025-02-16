import * as Sg from "@microsoft/signalr";
import { readable, writable, derived, readonly, get } from "svelte/store";
import type { Message, User } from "$lib/signalr/types";
import { AccessToken } from "$lib/auth";
import { ApiRoute } from "$lib/constants";
import createLogger from "$lib/logger";
import { TimeoutError } from "$lib/helpers";

// internal interop types, keep in sync with api types 
type ChatHubUser = {
    id: string;
    username: string;
}

type ChatHubMessage = {
    id: string;
    userId: string;
    content: string;
};

interface IChatHubClient {
	selfJoined(connectedUsers: ChatHubUser[], allUsers: ChatHubUser[], messages: ChatHubMessage[]): Promise<void>;
	messageReceived(message: ChatHubMessage): Promise<void>;
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
        await this.#impl.connect();
    }

    async disconnect() {
        await this.#impl.disconnect();
    }

    async sendMessage(message: string) {
        await this.#impl.sendMessage(message);
    }
}

// exposes the actual chathub rpc implementation, only for internal usage
class ChatHubClientImpl implements IChatHubClient {

    #connection: Sg.HubConnection | undefined;
    parent: ChatHubClient;
    logger = createLogger("ChatHubClientImpl");

    constructor(parent: ChatHubClient){
        this.parent = parent;
    }

    getConnection(): Sg.HubConnection {
        if (this.#connection === undefined) {
            throw new Error("Client not connected");
        }

        return this.#connection;
    }

    async wrapTimeoutError<T>(promise: Promise<T>): Promise<T> {
        try {
            return await promise;
        } catch (e) {
            this.logger.logError(e);
            if (e instanceof Sg.TimeoutError) {
                throw new TimeoutError("SignalR request timed out", { cause: e });
            } else {
                throw e;
            }
        }
    }

    async invoke<T>(method: string, ...args: any[]): Promise<T> {
        const connection = this.getConnection();
        const result = await this.wrapTimeoutError(connection.invoke(method, ...args)) as T;
        this.logger.logDebug("invoked", method, args, result);
        return result;
    }

    async send(method: string, ...args: any[]): Promise<void> {
        const connection = this.getConnection();
        await this.wrapTimeoutError(connection.send(method, ...args));
        this.logger.logDebug("sent", method, args)
    }

    async connect() {
        if (this.#connection !== undefined) {
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

        con.serverTimeoutInMilliseconds = 5 * 1000;
        
        con.on("SelfJoined", this.selfJoined.bind(this));
        con.on("MessageReceived", this.messageReceived.bind(this));
        con.on("UserJoined", this.userJoined.bind(this));
        con.on("UserLeft", this.userLeft.bind(this));

        this.#connection = con;

        this.logger.logInfo("Starting connection", con);
        await this.wrapTimeoutError(this.#connection.start());
    }

    async disconnect() {
        if (this.#connection === undefined) {
            return;
        }

        this.logger.logInfo("Stopping connection");
        await this.wrapTimeoutError(this.#connection.stop());
        this.#connection = undefined;
    }

    async selfJoined(connectedUsers: ChatHubUser[], allUsers: ChatHubUser[], messages: ChatHubMessage[]) {
        this.logger.logDebug("selfJoined", connectedUsers, allUsers, messages);
        connectedUsersStore.set(connectedUsers.map<User>(({ id, username }) => ({ id, username })));
        allUsersStore.set(allUsers.map<User>(({ id, username }) => ({ id, username })));
        messagesStore.set(messages.map<Message>(({ id, content, userId }) => ({ id, content, user: getUserById(userId) })));
    }

    async messageReceived(message: ChatHubMessage) {
        const { id, userId, content } = message;
        this.logger.logDebug("messageReceived", message);
        messagesStore.update(arr => [...arr, { id, content, user: getUserById(userId) }]);
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