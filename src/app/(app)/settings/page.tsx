import { requireUser } from "@/server/auth";
import { getT } from "@/i18n/server";
import Link from "next/link";
import { PushToggle } from "@/components/PushToggle";
import { SettingsPanel } from "@/components/SettingsPanel";

export default async function SettingsPage() {
  const user = await requireUser();
  const { t } = await getT();
  return (
    <>
      <h1 className="text-xl font-semibold">{t("settings.title")}</h1>
      <div className="card">
        <p className="font-medium">{user.name}</p>
        <p className="muted">@{user.username}{user.email ? ` · ${user.email}` : ""}</p>
        {user.isAdmin && <p className="muted mt-2">{t("settings.admin")}</p>}
      </div>
      {!user.impersonating && <Link href="/change-password" className="btn-secondary">{t("password.link")}</Link>}
      {user.isAdmin && <Link href="/admin/users" className="btn-secondary" data-testid="admin-link">{t("admin.usersLink")}</Link>}
      <PushToggle />
      <SettingsPanel />
      <p className="muted">{t("settings.install")}</p>
    </>
  );
}
