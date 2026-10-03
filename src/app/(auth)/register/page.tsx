import { redirect } from "next/navigation";
import { count } from "drizzle-orm";
import { getCurrentUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { env } from "@/server/env";
import { users } from "@/server/schema";
import { getT } from "@/i18n/server";
import { AuthForm } from "@/components/AuthForm";
import { isInviteValid } from "@/server/services/groups";

export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string; invite?: string }> }) {
  const { next, invite } = await searchParams;
  if (await getCurrentUser()) redirect("/");
  const { t } = await getT();
  const [{ n }] = await getDb().select({ n: count() }).from(users);
  const first = n === 0;
  const inviteOk = invite ? await isInviteValid(invite) : false;
  if (!first && !env.registrationEnabled && !inviteOk) {
    return <p className="card text-center">{t("auth.registrationDisabled")}</p>;
  }
  return (
    <>
      {first && <p className="card text-sm">{t("auth.firstUser")}</p>}
      <AuthForm mode="register" inviteCode={inviteOk ? invite : undefined} next={inviteOk ? "/" : next} />
    </>
  );
}
