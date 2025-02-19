
export type Guid = string;

export type UserId = Guid;
export type RoomId = Guid;
export type MessageId = Guid;

export type ChatHubRoom = { 
    readonly id: RoomId,
    readonly name: string
};
export type ChatHubUser = { 
    readonly id: UserId,
    readonly username: string
};
export type ChatHubMessage = { 
    readonly id: MessageId,
    readonly roomId: RoomId, 
    readonly userId: UserId, 
    readonly content: string
}

// this interface is implemented on client side and called from server.
export interface IChatHubClient
{
	onConnected(joinedRooms: ChatHubRoom[], availableRooms: ChatHubRoom[]): Promise<void>;
	messageReceived(message: ChatHubMessage): Promise<void>;
	roomCreated(room: ChatHubRoom): Promise<void>;
	userJoinedRoom(userId: UserId, roomId: RoomId, username: string): Promise<void>;
	userLeftRoom(userId: UserId, roomId: RoomId): Promise<void>;
	userOpenedRoom(userId: UserId, roomId: RoomId): Promise<void>;
	userClosedRoom(userId: UserId, roomId: RoomId): Promise<void>;
}

// this interface is implemented on server side and called from client.
export interface IChatHubServer
{
	sendMessage(roomId: RoomId, content: string): Promise<void>;
    createRoom(name: string): Promise<void>;
	joinRoom(roomId: RoomId): Promise<void>;
	leaveRoom(roomId: RoomId): Promise<void>;
	openRoom(roomId: RoomId): Promise<OpenRoomResponse>;
	closeRoom(roomId: RoomId): Promise<void>;
}

export type CreateRoomResponse = { 
    readonly roomId: RoomId 
};

export type OpenRoomResponse = { 
    readonly allUsers: ChatHubUser[], 
    readonly connectedUsers: ChatHubUser[], 
    readonly messages: ChatHubMessage[] 
};

export type HubError = {
    code: ErrorCode;
    errorMessage: string | null;
}

export enum ErrorCode {
    InvalidArgumentError = "InvalidArgumentError",
    RoomAlreadyExistsError = "RoomAlreadyExistsError",
    RoomNotFoundError = "RoomNotFoundError",
    UserHasNotJoinedRoomError = "UserHasNotJoinedRoomError"
}

