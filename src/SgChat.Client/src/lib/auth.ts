import { get, readonly, writable } from "svelte/store";
import { ApiRoute } from "./constants";

export type User = {
    username: string;
    userId: string;
}



// jwt token NOT stored in local storage or cookies because that makes testing easier.
// this isnt a real app after all

const currentUserStore = writable<User | null>(null);
export const CurrentUser = readonly(currentUserStore);

const accessTokenStore = writable<string | null>(null);
export const AccessToken = readonly(accessTokenStore);

export const isLoggedIn = () => get(currentUserStore) !== null;

export const login = async (username: string): Promise<boolean> => {
    const response = await fetch(ApiRoute + "/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "accept": "application/json" },
        body: JSON.stringify({ username })
    });

    const json = await response.json() as { token: string, username: string, userId: string };

    if (!(json.token && json.username && json.userId)) {
        throw new Error("Invalid response");
    }

    console.log(json);

    accessTokenStore.set(json.token);
    currentUserStore.set({ username: json.username, userId: json.userId });
    
    return true;
}

export const logout = async () => {
    await fetch(ApiRoute + "/auth/logout");
    accessTokenStore.set(null);
    currentUserStore.set(null);
}