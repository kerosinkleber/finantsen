import Link from "next/link";
import { requireAdminUser } from "@/server/auth";
import { getT } from "@/i18n/server";
import { listUsers } from "@/server/services/accounts";
import { getAdminSettings, smtpSettingsPublic } from "@/server/services/settings";
import { mailSource } from "@/server/mail/mailer";
import { AdminSettings } from "@/components/AdminSettings";
import { UsersAdmin, type AdminUser } from "@/components/UsersAdmin";
import { TestLeftoversWarning } from "@/components/TestLeftoversWarning";
import { InsecureInfo } from "@/components/InsecureInfo";
import { testLeftovers } from "@/server/services/testUsers";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = await requireAdminUser();
  const { t } = await getT();
  const [users, settings, source, smtp, leftovers] = await Promise.all([listUsers(admin), getAdminSettings(), mailSource(), smtpSettingsPublic(), testLeftovers(admin)]);
  const view: AdminUser[] = users.map((u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    status: u.status as AdminUser["status"],
    isAdmin: u.isAdmin,
    mustChangePassword: u.mustChangePassword,
    lockedUntil: u.lockedUntil ? u.lockedUntil.toISOString() : null,
    totpEnabled: u.totpEnabled,
    totpRequired: u.totpRequired,
    passkeyCount: u.passkeyCount,
  }));
  return (
    <>
      <h1 className="text-xl font-semibold">{t("admin.users")}</h1>
      <InsecureInfo admin />
      <TestLeftoversWarning enabled={leftovers.enabled} testUsers={leftovers.testUsers} />
      {/* key: nach Änderungen an anderer Stelle (z. B. Warnhinweis) mit den neuen Werten neu aufbauen */}
      <AdminSettings key={JSON.stringify(settings)} initial={settings} mail={{ source, smtp }} />
      {settings.testFeaturesEnabled && <Link href="/admin/test-users" className="btn-secondary" data-testid="test-users-link">{t("test.link")}</Link>}
      <UsersAdmin users={view} meId={admin.id} />
      <Link href="/settings" className="btn-secondary">{t("common.back")}</Link>
    </>
  );
}
