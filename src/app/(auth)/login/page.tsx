import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { AuthForm } from "@/components/AuthForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(next?.startsWith("/") ? next : "/");
  return <AuthForm mode="login" next={next} />;
}
