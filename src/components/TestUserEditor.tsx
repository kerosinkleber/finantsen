"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { ErrorMessage } from "./ErrorMessage";
import { useActAs } from "./TestUsersAdmin";
import type { MessageKey } from "@/i18n";

type Membership = { groupId: string; kind: string; name: string; role: string; members: { id: string; name: string; isTest: boolean }[]; hasRealMembers: boolean };
export type TestUserDetail = {
  user: { id: string; name: string; username: string; locale: string };
  memberships: Membership[];
  addableGroups: { id: string; name: string; hasRealMembers: boolean }[];
  friendCandidates: { id: string; name: string; isTest: boolean; isYou: boolean }[];
};
type BlockedGroup = { id: string; name: string; users: string[] };

export function TestUserEditor({ detail }: { detail: TestUserDetail }) {
  const { t } = useI18n();
  const router = useRouter();
  const actAs = useActAs();
  const u = detail.user;
  const [name, setName] = useState(u.name);
  const [username, setUsername] = useState(u.username);
  const [locale, setLocale] = useState(u.locale);
  const [groupId, setGroupId] = useState("");
  const [role, setRole] = useState<"member" | "owner">("member");
  const [friendId, setFriendId] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [blocked, setBlocked] = useState<BlockedGroup[] | null>(null);
  const [saved, setSaved] = useState(false);
  const refresh = () => router.refresh();

  /** Führt eine Aktion aus; bei „needs_confirmation“/„balance_not_zero“ erst nach Bestätigung erneut mit confirmed. */
  async function membership(body: Record<string, unknown>) {
    setError(null);
    try {
      await api("POST", `/api/admin/test-users/${u.id}/membership`, body);
      refresh();
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "needs_confirmation") {
        const names = ((e.data?.realMembers ?? []) as string[]).join(", ");
        if (confirm(t("test.confirmReal", { names }))) return membership({ ...body, confirmed: true });
        return;
      }
      if (e instanceof ApiClientError && e.code === "balance_not_zero" && e.data?.needsConfirmation) {
        if (confirm(t("test.confirmBalance"))) return membership({ ...body, confirmed: true });
        return;
      }
      setError(e);
    }
  }

  async function saveProfile() {
    setError(null);
    setSaved(false);
    try {
      await api("PATCH", `/api/admin/test-users/${u.id}`, { name, username, locale });
      setSaved(true);
      refresh();
    } catch (e) {
      setError(e);
    }
  }

  async function remove() {
    if (!confirm(t("test.confirmDelete"))) return;
    setError(null);
    setBlocked(null);
    try {
      await api("DELETE", `/api/admin/test-users/${u.id}`);
      router.replace("/admin/test-users");
      router.refresh();
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "test_user_in_real_group") setBlocked((e.data?.groups ?? []) as BlockedGroup[]);
      else setError(e);
    }
  }

  const label = "label";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {u.name} <span className="muted">@{u.username}</span>
        </h2>
        <button className="btn" onClick={() => actAs(u.id)}>{t("test.actAs")}</button>
      </div>

      <section className="card flex flex-col gap-3" data-testid="test-profile">
        <h3 className="font-semibold">{t("test.profile")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="p-name">{t("auth.displayName")}</label>
            <input id="p-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </div>
          <div>
            <label className={label} htmlFor="p-user">{t("auth.username")}</label>
            <input id="p-user" className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" spellCheck={false} />
          </div>
        </div>
        <div>
          <label className={label} htmlFor="p-lang">{t("test.language")}</label>
          <select id="p-lang" className="input" value={locale} onChange={(e) => setLocale(e.target.value)}>
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
        </div>
        <button className="btn-secondary" onClick={saveProfile}>{t("admin.action.save")}</button>
        {saved && <p className="pos text-sm" role="status">{t("test.saved")}</p>}
      </section>

      <section className="card flex flex-col gap-3" data-testid="test-memberships">
        <h3 className="font-semibold">{t("test.memberships")}</h3>
        {detail.memberships.length === 0 && <p className="muted">{t("test.noMemberships")}</p>}
        <ul className="flex flex-col gap-3">
          {detail.memberships.map((m) => (
            <li key={m.groupId} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700" data-testid="membership" data-group={m.name}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-medium">{m.name}</span>{" "}
                  <span className="muted">{m.kind === "direct" ? t("test.kindFriend") : t("test.kindGroup")}</span>
                  {m.hasRealMembers && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs dark:bg-slate-700">{t("test.realMembers")}</span>}
                </span>
                <button className="btn-danger !min-h-9 !px-3" onClick={() => membership({ action: "removeGroup", groupId: m.groupId })}>{t("test.remove")}</button>
              </div>
              <p className="muted">{m.members.map((x) => x.name).join(", ")}</p>
              {m.kind === "group" && (
                <label className="flex items-center gap-2 text-sm">
                  {t("test.role")}
                  <select
                    className="input !w-auto"
                    aria-label={`${t("test.role")} ${m.name}`}
                    value={m.role}
                    onChange={(e) => membership({ action: "setRole", groupId: m.groupId, role: e.target.value })}
                  >
                    {(["member", "owner"] as const).map((r) => (
                      <option key={r} value={r}>{t(`test.role.${r}` as MessageKey)}</option>
                    ))}
                  </select>
                </label>
              )}
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
          <h4 className="font-medium">{t("test.addToGroup")}</h4>
          {detail.addableGroups.length === 0 ? (
            <p className="muted">{t("test.noGroups")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <select className="input !w-auto min-w-48" aria-label={t("test.pickGroup")} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">{t("test.pickGroup")}</option>
                {detail.addableGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}{g.hasRealMembers ? " ⚠" : ""}</option>
                ))}
              </select>
              <select className="input !w-auto" aria-label={t("test.role")} value={role} onChange={(e) => setRole(e.target.value as "member" | "owner")}>
                {(["member", "owner"] as const).map((r) => (
                  <option key={r} value={r}>{t(`test.role.${r}` as MessageKey)}</option>
                ))}
              </select>
              <button className="btn-secondary" disabled={!groupId} onClick={() => membership({ action: "addGroup", groupId, role })}>{t("test.add")}</button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
          <h4 className="font-medium">{t("test.addFriend")}</h4>
          {detail.friendCandidates.length === 0 ? (
            <p className="muted">{t("test.noFriends")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <select className="input !w-auto min-w-48" aria-label={t("test.pickFriend")} value={friendId} onChange={(e) => setFriendId(e.target.value)}>
                <option value="">{t("test.pickFriend")}</option>
                {detail.friendCandidates.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.isYou ? ` (${t("common.you")})` : ""}</option>
                ))}
              </select>
              <button className="btn-secondary" disabled={!friendId} onClick={() => membership({ action: "addFriend", userId: friendId })}>{t("test.connect")}</button>
            </div>
          )}
        </div>
      </section>

      <ErrorMessage error={error} />
      {blocked && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300" data-testid="delete-blocked">
          <p>{t("test.deleteBlocked")}</p>
          <ul className="mt-1 list-disc pl-5">
            {blocked.map((g) => (
              <li key={g.id}>{t("test.deleteBlockedItem", { group: g.name, users: g.users.join(", ") })}</li>
            ))}
          </ul>
        </div>
      )}
      <button className="btn-danger" onClick={remove}>{t("test.delete")}</button>
    </div>
  );
}
