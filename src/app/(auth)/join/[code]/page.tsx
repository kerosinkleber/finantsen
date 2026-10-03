import Link from "next/link";
import { getCurrentUser } from "@/server/auth";
import { previewInvite } from "@/server/services/groups";
import { getT } from "@/i18n/server";
import { AcceptInvite } from "@/components/AcceptInvite";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { t } = await getT();
  const invite = await previewInvite(code);
  if (!invite) return <p className="card text-center">{t("join.invalid")}</p>;
  const user = await getCurrentUser();
  const text =
    invite.kind === "direct"
      ? t("join.friend", { inviter: invite.inviter })
      : t("join.group", { inviter: invite.inviter, name: invite.groupName ?? "" });
  return (
    <div className="card flex flex-col gap-4 text-center">
      <h2 className="text-xl font-semibold">{t("join.title")}</h2>
      <p>{text}</p>
      {user ? (
        <AcceptInvite code={code} />
      ) : (
        <>
          <p className="muted">{t("join.needLogin")}</p>
          <Link className="btn" href={`/register?invite=${encodeURIComponent(code)}`}>{t("auth.register")}</Link>
          <Link className="btn-secondary" href={`/login?next=${encodeURIComponent(`/join/${code}`)}`}>{t("auth.login")}</Link>
        </>
      )}
    </div>
  );
}
