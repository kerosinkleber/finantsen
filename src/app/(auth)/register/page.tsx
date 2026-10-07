import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { getT } from "@/i18n/server";
import { RegisterForm } from "@/components/AccountForms";
import { needsSetup } from "@/server/services/accounts";
import { registrationEnabled } from "@/server/services/settings";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await needsSetup()) redirect("/setup");
  if (await getCurrentUser()) redirect("/");
  const { t } = await getT();
  if (!(await registrationEnabled())) return <p className="card text-center" data-testid="register-disabled">{t("register.disabled")}</p>;
  return <RegisterForm />;
}
