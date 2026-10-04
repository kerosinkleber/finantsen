import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdminUser } from "@/server/auth";
import { getT } from "@/i18n/server";
import { getTestUserDetail } from "@/server/services/testUsers";
import { testFeaturesEnabled } from "@/server/services/settings";
import { ApiError } from "@/server/http";
import { TestUserEditor } from "@/components/TestUserEditor";

export const dynamic = "force-dynamic";

export default async function TestUserPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  const { id } = await params;
  const { t } = await getT();
  if (!(await testFeaturesEnabled())) redirect("/admin/test-users");
  const detail = await getTestUserDetail(admin, id).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  return (
    <>
      <h1 className="text-xl font-semibold">{t("test.title")}</h1>
      <TestUserEditor detail={detail} />
      <Link href="/admin/test-users" className="btn-secondary">{t("test.back")}</Link>
    </>
  );
}
