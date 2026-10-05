import { requireUser } from "@/server/auth";
import { getT } from "@/i18n/server";
import Link from "next/link";
import { PushToggle } from "@/components/PushToggle";
import { InsecureInfo } from "@/components/InsecureInfo";
import { InstallHint } from "@/components/InstallHint";
import { SettingsPanel } from "@/components/SettingsPanel";
import { EmailSettings } from "@/components/EmailSettings";
import { getEmailPrefs } from "@/server/services/accounts";
import { PaymentSettings } from "@/components/PaymentSettings";
import { getOwnPayInfo } from "@/server/services/payinfo";

export default async function SettingsPage() {
  const user = await requireUser();
  const { t } = await getT();
  // Beim Handeln als Testnutzer keine Mail-Einstellungen (Testnutzer bekommen nie Mails)
  const emailPrefs = user.impersonating ? null : await getEmailPrefs(user.id);
  const payInfo = user.impersonating ? null : await getOwnPayInfo(user.id);
  return (
    <>
      <h1 className="text-xl font-semibold">{t("settings.title")}</h1>
      <div className="card">
        <p className="font-medium">{user.name}</p>
        <p className="muted">@{user.username}{user.email ? ` · ${user.email}` : ""}</p>
        {user.isAdmin && <p className="muted mt-2">{t("settings.admin")}</p>}
      </div>
      {!user.impersonating && <Link href="/change-password" className="btn-secondary">{t("password.link")}</Link>}
      {!user.impersonating && <Link href="/two-factor" className="btn-secondary" data-testid="two-factor-link">{t("totp.link")}</Link>}
      {user.isAdmin && <Link href="/admin/users" className="btn-secondary" data-testid="admin-link">{t("admin.usersLink")}</Link>}
      <a href="/api/account/export" download className="btn-secondary" data-testid="export-account">{t("export.account")}</a>
      <InsecureInfo />
      <PushToggle />
      {emailPrefs && <EmailSettings initial={emailPrefs} />}
      {payInfo && emailPrefs && <PaymentSettings initial={payInfo} hasPassword={emailPrefs.hasPassword} />}
      <SettingsPanel />
      <InstallHint />
    </>
  );
}
