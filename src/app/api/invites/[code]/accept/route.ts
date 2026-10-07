import { route } from "@/server/http";
import { acceptInvite } from "@/server/services/groups";

export const POST = route<{ code: string }>(async ({ user, params }) => acceptInvite(user.id, params.code));
