import { route } from "@/server/http";
import { devLogin } from "@/server/services/accounts";
import { createSession } from "@/server/auth";

/**
 * NUR ENTWICKLUNG (DEV_ADMIN=true): meldet den passwortlosen Admin "admin" an.
 * Ohne die Variable (Produktiv) oder sobald der Admin ein Passwort hat, antwortet die Route mit 404.
 */
export const POST = route(
  async () => {
    const user = await devLogin();
    await createSession(user.id);
    return { user: { id: user.id, username: user.username, name: user.name, isAdmin: true } };
  },
  { auth: false },
);
