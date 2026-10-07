import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { ForgotPasswordForm } from "@/components/AccountForms";
import { mailEnabled } from "@/server/mail/mailer";
import { passwordResetEnabled } from "@/server/services/settings";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  if (await getCurrentUser()) redirect("/");
  // Ohne Mailversand (oder vom Admin abgeschaltet) gibt es die Seite nicht
  if (!(await mailEnabled()) || !(await passwordResetEnabled())) redirect("/login");
  return <ForgotPasswordForm />;
}
