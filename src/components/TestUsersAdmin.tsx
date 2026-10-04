"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import { ErrorMessage } from "./ErrorMessage";

export type TestUserRow = { id: string; name: string; username: string; groupCount: number };

/** „Handeln als“ starten und in die App wechseln. */
export function useActAs() {
  const router = useRouter();
  return async (id: string) => {
    await api("POST", "/api/admin/act", { userId: id });
    router.push("/");
    router.refresh();
  };
}

export function TestUsersAdmin({ users }: { users: TestUserRow[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const actAs = useActAs();
  const [count, setCount] = useState("3");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function create(body: object) {
    setBusy(true);
    setError(null);
    try {
      await api("POST", "/api/admin/test-users", body);
      setName("");
      setUsername("");
      router.refresh();
    } catch (e) {
      setError(e);
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="muted">{t("test.intro")}</p>
      <section className="card flex flex-col gap-3" data-testid="test-create">
        <h2 className="font-semibold">{t("test.create")}</h2>
        <div className="flex items-end gap-2">
          <div>
            <label className="label" htmlFor="tcount">{t("test.count")}</label>
            <input id="tcount" className="input !w-24" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
          <button className="btn" disabled={busy} onClick={() => create({ count: Number(count) })}>{t("test.createN")}</button>
        </div>
        <details>
          <summary className="muted cursor-pointer">{t("test.createOne")}</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="tname">{t("auth.displayName")}</label>
              <input id="tname" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder={username || undefined} />
            </div>
            <div>
              <label className="label" htmlFor="tuser">{t("auth.username")}</label>
              <input id="tuser" className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" spellCheck={false} />
            </div>
          </div>
          <button className="btn-secondary mt-3" disabled={busy || !username} onClick={() => create({ name: name || undefined, username })}>{t("test.createN")}</button>
        </details>
        <ErrorMessage error={error} />
      </section>

      {users.length === 0 && <p className="muted">{t("test.none")}</p>}
      <ul className="flex flex-col gap-2">
        {users.map((u) => (
          <li key={u.id} className="card flex flex-wrap items-center justify-between gap-2" data-testid="test-user" data-username={u.username}>
            <span>
              <span className="font-medium">{u.name}</span> <span className="muted">@{u.username}</span>
              <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-xs text-amber-900">{t("test.badge")}</span>
              <span className="muted block">{t("test.groupsCount", { n: u.groupCount })}</span>
            </span>
            <span className="flex gap-2">
              <Link className="btn-secondary !min-h-9 !px-3" href={`/admin/test-users/${u.id}`}>{t("test.edit")}</Link>
              <button className="btn !min-h-9 !px-3" onClick={() => actAs(u.id)}>{t("test.actAs")}</button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
