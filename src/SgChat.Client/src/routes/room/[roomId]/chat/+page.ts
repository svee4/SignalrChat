import { CurrentUser } from "$lib/auth";
import { redirect } from "@sveltejs/kit";
import { get } from "svelte/store";
import type { PageLoad } from "./$types";
import { Hub } from "$lib/signalr/chatHub";

export const load: PageLoad = async ({ params }) => {
	if (get(CurrentUser) === null) {
        redirect(307, "/auth/login");
    }

    await Hub.openRoom(params.roomId);

    return {
        roomId: params.roomId
    };
};