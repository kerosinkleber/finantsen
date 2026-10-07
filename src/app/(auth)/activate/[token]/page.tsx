import { getT } from "@/i18n/server";
import { ActivateForm } from "@/components/AccountForms";
import { peekLink } from "@/server/services/accounts";

export const dynamic = "force-dynamic";

export default async function ActivatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { t } = await getT();
  const link = await peekLink(token);
  if (!link) return <p className="card text-center" data-testid="link-invalid">{t("activate.invalid")}</p>;
  return <ActivateForm token={token} name={link.name} username={link.username} purpose={link.purpose} />;
}
