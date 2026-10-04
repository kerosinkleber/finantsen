import Link from "next/link";
import { requireAdminUser } from "@/server/auth";
import { getT } from "@/i18n/server";
import { listUsers } from "@/server/services/accounts";
import { getAdminSettings } from "@/server/services/settings";
import { AdminSettings } from "@/components/AdminSettings";
import { UsersAdmin, type AdminUser } from "@/components/UsersAdmin";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = await requireAdminUser();
  const { t } = await getT();
  const [users, settings] = await Promise.all([listUsers(admin), getAdminSettings()]);
  const view: AdminUser[] = users.map((u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    status: u.status as AdminUser["status"],
    isAdmin: u.isAdmin,
    mustChangePassword: u.mustChangePassword,
    lockedUntil: u.lockedUntil ? u.lockedUntil.toISOString() : null,
  }));
  return (
    <>
      <h1 className="text-xl font-semibold">{t("admin.users")}</h1>
      <AdminSettings initial={settings} />
      {settings.testFeaturesEnabled && <Link href="/admin/test-users" className="btn-secondary" data-testid="test-users-link">{t("test.link")}</Link>}
      <UsersAdmin users={view} meId={admin.id} />
      <Link href="/settings" className="btn-secondary">{t("common.back")}</Link>
    </>
  );
}
