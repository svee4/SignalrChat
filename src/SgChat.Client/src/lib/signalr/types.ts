
export type User = {
    readonly id: string;
    readonly username: string;
}

export type Room = {
    readonly id: string;
    readonly name: string;
}

export type Message = {
    readonly id: string;
    readonly user: User;
    readonly room: Room;
    readonly content: string;
}