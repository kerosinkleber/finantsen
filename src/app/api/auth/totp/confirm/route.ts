import { z } from "zod";
import { route, parseBody } from "@/server/http";
import { confirmEnrollment } from "@/server/services/totp";

export const POST = route(
  async ({ req, user }) => {
    const body = await parseBody(req, z.object({ code: z.string().trim().min(6).max(12) }));
    return confirmEnrollment(user.real.id, body.code);
  },
  { allowTotpSetup: true },
);
