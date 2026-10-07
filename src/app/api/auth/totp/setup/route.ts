import { route } from "@/server/http";
import { startEnrollment } from "@/server/services/totp";
import { qrDataUrl } from "@/server/qr";

export const POST = route(
  async ({ user }) => {
    const r = await startEnrollment(user.real.id);
    return { ...r, qr: await qrDataUrl(r.uri) };
  },
  { allowTotpSetup: true },
);
