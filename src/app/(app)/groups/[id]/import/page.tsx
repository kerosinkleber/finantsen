import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getT } from "@/i18n/server";
import { getGroup } from "@/server/services/groups";
import { ApiError } from "@/server/http";
import { ImportForm } from "@/components/ImportForm";

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { t } = await getT();
  const group = await getGroup(user.id, id).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  return (
    <>
      <h1 className="text-xl font-semibold">{t("import.title", { group: group.displayName })}</h1>
      {group.role === "owner" ? <ImportForm groupId={id} /> : <p className="card">{t("err.owner_only")}</p>}
      <Link href={`/groups/${id}?tab=members`} className="btn-secondary">{t("common.back")}</Link>
    </>
  );
}
