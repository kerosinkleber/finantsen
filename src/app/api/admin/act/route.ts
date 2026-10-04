import { z } from "zod";
import { route, parseBody } from "@/server/http";
import { startActingAs, stopActingAs } from "@/server/services/testUsers";

/** Admin beginnt „Handeln als“ einen Testnutzer (nur Testnutzer, nur echte Admins). */
export const POST = route(async ({ req, user }) => {
  const { userId } = await parseBody(req, z.object({ userId: z.string().uuid() }));
  return { actingAs: await startActingAs(user, userId) };
});

/** Beendet „Handeln als“ (auch erreichbar, solange man als Testnutzer handelt). */
export const DELETE = route(async ({ user }) => {
  await stopActingAs(user);
  return { ok: true };
});
