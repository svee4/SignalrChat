import { CurrentUser } from "$lib/auth";
import { redirect } from "@sveltejs/kit";
import { get } from "svelte/store";

export const load = () => {
	if (get(CurrentUser) === null) {
        redirect(307, "/auth/login");
    }
};