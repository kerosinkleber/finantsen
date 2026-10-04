import { requireUser } from "@/server/auth";
import { ChangePasswordForm } from "@/components/AccountForms";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const user = await requireUser();
  return <ChangePasswordForm required={user.mustChangePassword} username={user.username} email={user.email} />;
}
