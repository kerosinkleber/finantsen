import { redirect } from "next/navigation";
import { SetupForm } from "@/components/AccountForms";
import { needsSetup } from "@/server/services/accounts";

export const dynamic = "force-dynamic";

/** Ersteinrichtung: nur erreichbar, solange noch kein Konto existiert. */
export default async function SetupPage() {
  if (!(await needsSetup())) redirect("/login");
  return <SetupForm />;
}
