import Link from "next/link";
import { requireAdminUser } from "@/server/auth";
import { getT } from "@/i18n/server";
import { listTestUsers } from "@/server/services/testUsers";
import { testFeaturesEnabled } from "@/server/services/settings";
import { TestUsersAdmin } from "@/components/TestUsersAdmin";

export const dynamic = "force-dynamic";

export default async function TestUsersPage() {
  const admin = await requireAdminUser();
  const { t } = await getT();
  if (!(await testFeaturesEnabled())) {
    return (
      <>
        <h1 className="text-xl font-semibold">{t("test.title")}</h1>
        <div className="card flex flex-col gap-3" data-testid="test-disabled">
          <p className="font-medium">{t("test.disabledTitle")}</p>
          <p className="muted">{t("test.disabledText")}</p>
          <Link className="btn" href="/admin/users">{t("test.toSettings")}</Link>
        </div>
      </>
    );
  }
  const users = await listTestUsers(admin);
  return (
    <>
      <h1 className="text-xl font-semibold">{t("test.title")}</h1>
      <TestUsersAdmin users={users} />
      <Link href="/admin/users" className="btn-secondary">{t("common.back")}</Link>
    </>
  );
}
