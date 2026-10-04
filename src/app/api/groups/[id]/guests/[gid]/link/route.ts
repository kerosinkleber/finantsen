import { route } from "@/server/http";
import { createGuestLink } from "@/server/services/guests";

/** Verknüpfungs-Link für einen Gast (7 Tage, einmalig; ersetzt ältere Links). */
export const POST = route<{ id: string; gid: string }>(async ({ user, params }) => createGuestLink(user.id, params.id, params.gid));
