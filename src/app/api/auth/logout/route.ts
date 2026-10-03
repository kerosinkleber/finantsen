import { route } from "@/server/http";
import { destroySession } from "@/server/auth";

export const POST = route(
  async () => {
    await destroySession();
    return { ok: true };
  },
  { auth: false },
);
