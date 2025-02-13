
export type Message = {
    readonly id: string;
    readonly user: User;
    readonly message: string;
}

export type User = {
    readonly id: string;
    readonly username: string;
}