
export type Message = {
    readonly id: string;
    readonly user: User;
    readonly content: string;
}

export type User = {
    readonly id: string;
    readonly username: string;
}
