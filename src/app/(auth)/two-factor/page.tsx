import { requireUser } from "@/server/auth";
import { totpStatus } from "@/server/services/totp";
import { TwoFactor } from "@/components/TwoFactor";
import { Passkeys } from "@/components/Passkeys";
import { listPasskeys } from "@/server/services/passkeys";

export const dynamic = "force-dynamic";

export default async function TwoFactorPage() {
  const user = await requireUser();
  const status = await totpStatus(user.real.id);
  const pk = await listPasskeys(user.real.id);
  return (
    <>
      <TwoFactor initial={status} forced={user.totpSetupRequired} />
      <Passkeys initial={pk.map((p) => ({ ...p, createdAt: p.createdAt.toISOString(), lastUsedAt: p.lastUsedAt?.toISOString() ?? null }))} forced={user.totpSetupRequired} />
    </>
  );
}
