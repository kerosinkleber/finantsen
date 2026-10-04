import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { LoginForm } from "@/components/AuthForm";
import { needsSetup } from "@/server/services/accounts";
import { registrationEnabled } from "@/server/services/settings";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await needsSetup()) redirect("/setup");
  if (await getCurrentUser()) redirect(next?.startsWith("/") ? next : "/");
  return <LoginForm next={next} registrationEnabled={await registrationEnabled()} />;
}
