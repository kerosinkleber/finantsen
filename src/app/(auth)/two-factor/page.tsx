import { requireUser } from "@/server/auth";
import { totpStatus } from "@/server/services/totp";
import { TwoFactor } from "@/components/TwoFactor";

export const dynamic = "force-dynamic";

export default async function TwoFactorPage() {
  const user = await requireUser();
  const status = await totpStatus(user.real.id);
  return <TwoFactor initial={status} forced={user.totpSetupRequired} />;
}
