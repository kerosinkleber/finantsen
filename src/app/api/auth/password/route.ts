import { route, parseBody } from "@/server/http";
import { changePasswordSchema } from "@/lib/schemas";
import { changePassword } from "@/server/services/accounts";
import { currentSessionId } from "@/server/auth";

/** Passwort ändern (aktuelles Passwort nötig); beendet alle anderen Sitzungen. */
export const POST = route(
  async ({ req, user }) => {
    const body = await parseBody(req, changePasswordSchema);
    await changePassword(user.id, body.current, body.next, await currentSessionId());
    return { ok: true };
  },
  { allowMustChange: true },
);
