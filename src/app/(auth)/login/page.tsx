import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { getCurrentUser } from "@/server/auth";
import { LoginForm } from "@/components/AuthForm";
import { needsSetup } from "@/server/services/accounts";
import { passwordResetEnabled, registrationEnabled } from "@/server/services/settings";
import { mailEnabled } from "@/server/mail/mailer";
import { devAdminAvailable } from "@/server/services/accounts";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await needsSetup()) redirect("/setup");
  if (await getCurrentUser()) redirect(safeNext(next));
  const passwordReset = (await mailEnabled()) && (await passwordResetEnabled());
  return <LoginForm next={next} registrationEnabled={await registrationEnabled()} devAdmin={await devAdminAvailable()} passwordReset={passwordReset} />;
}
