import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { getCurrentUser } from "@/server/auth";
import { LoginForm } from "@/components/AuthForm";
import { needsSetup } from "@/server/services/accounts";
import { registrationEnabled } from "@/server/services/settings";
import { devAdminAvailable } from "@/server/services/accounts";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await needsSetup()) redirect("/setup");
  if (await getCurrentUser()) redirect(safeNext(next));
  return <LoginForm next={next} registrationEnabled={await registrationEnabled()} devAdmin={await devAdminAvailable()} />;
}
