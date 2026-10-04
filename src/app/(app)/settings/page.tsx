import { requireUser } from "@/server/auth";
import { getT } from "@/i18n/server";
import { AdminSettings } from "@/components/AdminSettings";
import { getAdminSettings } from "@/server/services/settings";
import { PushToggle } from "@/components/PushToggle";
import { SettingsPanel } from "@/components/SettingsPanel";

export default async function SettingsPage() {
  const user = await requireUser();
  const { t } = await getT();
  const admin = user.isAdmin ? await getAdminSettings() : null;
  return (
    <>
      <h1 className="text-xl font-semibold">{t("settings.title")}</h1>
      <div className="card">
        <p className="font-medium">{user.name}</p>
        <p className="muted">{user.email}</p>
        {user.isAdmin && <p className="muted mt-2">{t("settings.admin")}</p>}
      </div>
      {admin && <AdminSettings initial={admin} />}
      <PushToggle />
      <SettingsPanel />
      <p className="muted">{t("settings.install")}</p>
    </>
  );
}
