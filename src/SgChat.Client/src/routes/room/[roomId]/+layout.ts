import { CurrentUser } from "$lib/auth";
import { CurrentRoom, Hub } from "$lib/signalr/chatHub";
import { redirect } from "@sveltejs/kit";
import { get } from "svelte/store";

export const load = async ({ params }) => {
    if (get(CurrentUser) === null) {
        redirect(307, "/auth/login");
    }

    if (get(CurrentRoom) === null) {
        console.log("opening room from layout");
        await Hub.openRoom(params.roomId)
        console.log("done openeing room from layout");

    }
};  