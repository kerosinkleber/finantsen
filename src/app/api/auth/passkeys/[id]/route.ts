import { z } from "zod";
import { route, parseBody } from "@/server/http";
import { deletePasskey } from "@/server/services/passkeys";

export const DELETE = route<{ id: string }>(
  async ({ req, user, params }) => {
    const body = await parseBody(req, z.object({ password: z.string().min(1).max(300) }));
    await deletePasskey(user.real.id, params.id, body.password);
    return { ok: true };
  },
  { allowTotpSetup: true },
);
