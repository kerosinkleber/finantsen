import { route, parseBody } from "@/server/http";
import { membershipActionSchema } from "@/lib/schemas";
import { addFriend, addToGroup, removeFromGroup, setGroupRole } from "@/server/services/testUsers";

/** Gruppenzugehörigkeit und Freundschaften eines Testnutzers ändern. */
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  const b = await parseBody(req, membershipActionSchema);
  switch (b.action) {
    case "addGroup":
      await addToGroup(user, params.id, b.groupId, { role: b.role, confirmed: b.confirmed });
      break;
    case "setRole":
      await setGroupRole(user, params.id, b.groupId, b.role);
      break;
    case "removeGroup":
      await removeFromGroup(user, params.id, b.groupId, { confirmed: b.confirmed });
      break;
    case "addFriend":
      await addFriend(user, params.id, b.userId, { confirmed: b.confirmed });
      break;
  }
  return { ok: true };
});
