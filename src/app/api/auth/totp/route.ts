import { route } from "@/server/http";
import { totpStatus } from "@/server/services/totp";

export const dynamic = "force-dynamic";
export const GET = route(async ({ user }) => totpStatus(user.real.id), { allowTotpSetup: true });
