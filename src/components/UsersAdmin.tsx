"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { useConfirm } from "./useConfirm";
import { useI18n } from "@/i18n/client";
import { ErrorMessage } from "./ErrorMessage";
import { QrCode } from "./QrCode";
import { PasswordField } from "./PasswordField";
import { passwordIssues } from "@/lib/password";
import type { MessageKey } from "@/i18n";

export type AdminUser = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  status: "active" | "invited" | "pending" | "disabled";
  isAdmin: boolean;
  mustChangePassword: boolean;
  lockedUntil: string | null;
  totpEnabled: boolean;
  totpRequired: boolean;
  passkeyCount: number;
};
type LinkInfo = { url: string; expiresAt: string; for: string };

function LinkBox({ link }: { link: LinkInfo }) {
  const { t, locale } = useI18n();
  const [copied, setCopied] = useState(false);
  // Die aktuelle Origin bevorzugen, falls APP_URL nicht gesetzt ist
  const token = link.url.split("/activate/")[1];
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/activate/${token}`;
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-slate-100 p-3 dark:bg-slate-800" data-testid="link-box">
      <p className="text-sm font-medium">{t("admin.linkTitle")}</p>
      <p className="muted">{t("admin.linkHelp", { name: link.for, until: new Date(link.expiresAt).toLocaleString(locale) })}</p>
      <div className="flex gap-2">
        <input readOnly className="input" value={url} data-testid="activation-link" onFocus={(e) => e.currentTarget.select()} />
        <button
          type="button"
          className="btn-secondary"
          onClick={async () => {
            await navigator.clipboard?.writeText(url).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? t("common.copied") : t("common.copy")}
        </button>
      </div>
      <QrCode text={url} label={t("invite.qrAlt")} />
    </div>
  );
}

function CreateUser({ onCreated }: { onCreated: (link: LinkInfo | null) => void }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<"link" | "password">("link");
  const [password, setPassword] = useState("");
  const [mustChange, setMustChange] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ user: { name: string }; link: { url: string; expiresAt: string } | null }>("POST", "/api/admin/users", {
        name,
        username,
        email: email || undefined,
        mode,
        password: mode === "password" ? password : undefined,
        mustChange,
        isAdmin,
      });
      onCreated(r.link ? { ...r.link, for: r.user.name } : null);
      setName("");
      setUsername("");
      setEmail("");
      setPassword("");
      setIsAdmin(false);
    } catch (err) {
      setError(err);
    }
    setBusy(false);
  }
  const pwInvalid = mode === "password" && passwordIssues(password, { username, email }).length > 0;
  return (
    <form onSubmit={submit} className="card flex flex-col gap-3" data-testid="create-user">
      <h2 className="font-semibold">{t("admin.createUser")}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="cu-name">{t("auth.displayName")}</label>
          <input id="cu-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder={username || undefined} />
        </div>
        <div>
          <label className="label" htmlFor="cu-username">{t("auth.username")}</label>
          <input id="cu-username" className="input" value={username} onChange={(e) => setUsername(e.target.value)} required pattern="[A-Za-z0-9][A-Za-z0-9._\-]{2,31}" autoCapitalize="none" spellCheck={false} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="cu-email">{t("auth.emailOptional")}</label>
        <input id="cu-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="label">{t("admin.mode")}</legend>
        {(["link", "password"] as const).map((m) => (
          <label key={m} className="flex items-center gap-3">
            <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} />
            {t(`admin.mode.${m}` as MessageKey)}
          </label>
        ))}
      </fieldset>
      {mode === "password" && (
        <>
          <PasswordField id="cu-password" label={t("auth.password")} value={password} onChange={setPassword} identity={{ username, email }} />
          <label className="flex items-center gap-3">
            <input type="checkbox" className="h-5 w-5" checked={mustChange} onChange={(e) => setMustChange(e.target.checked)} />
            {t("admin.mustChange")}
          </label>
        </>
      )}
      <label className="flex items-center gap-3">
        <input type="checkbox" className="h-5 w-5" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
        {t("admin.makeAdmin")}
      </label>
      <ErrorMessage error={error} />
      <button className="btn" disabled={busy || pwInvalid}>{t("admin.create")}</button>
    </form>
  );
}

function UserCard({ u, meId, onChanged, onLink }: { u: AdminUser; meId: string; onChanged: () => void; onLink: (l: LinkInfo) => void }) {
  const { t } = useI18n();
  const { ask, dialog } = useConfirm();
  const [error, setError] = useState<unknown>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [mustChange, setMustChange] = useState(true);
  const locked = u.lockedUntil && new Date(u.lockedUntil) > new Date();

  async function act(body: object, after?: (r: Record<string, unknown>) => void) {
    setError(null);
    try {
      const r = await api<Record<string, unknown>>("POST", `/api/admin/users/${u.id}`, body);
      after?.(r);
      onChanged();
    } catch (e) {
      setError(e);
    }
  }
  const btn = "btn-secondary !min-h-9 !px-3";
  return (
    <li className="card flex flex-col gap-2" data-testid="user-card" data-username={u.username}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{u.name}</span>
        <span className="muted">@{u.username}</span>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs dark:bg-slate-700" data-testid="status">{t(`admin.status.${u.status}` as MessageKey)}</span>
        {u.isAdmin && <span className="rounded-full bg-brand px-2 py-0.5 text-xs text-white">{t("admin.badge.admin")}</span>}
        {u.mustChangePassword && <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs text-amber-900">{t("admin.badge.mustChange")}</span>}
        {u.totpEnabled && <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-xs text-emerald-900" data-testid="badge-totp">{t("admin.badge.totp")}</span>}
        {u.passkeyCount > 0 && <span className="rounded-full bg-violet-200 px-2 py-0.5 text-xs text-violet-900" data-testid="badge-passkey">{t("admin.badge.passkey", { n: u.passkeyCount })}</span>}
        {u.totpRequired && <span className="rounded-full bg-sky-200 px-2 py-0.5 text-xs text-sky-900" data-testid="badge-totp-required">{t("admin.badge.totpRequired")}</span>}
        {locked && <span className="rounded-full bg-red-200 px-2 py-0.5 text-xs text-red-900">{t("admin.badge.locked")}</span>}
      </div>
      {u.email && <p className="muted">{u.email}</p>}
      <div className="flex flex-wrap gap-2">
        {u.status === "pending" && <button className={btn} onClick={() => act({ action: "approve" })}>{t("admin.action.approve")}</button>}
        {(u.status === "active" || u.status === "invited") && (
          <button className={btn} onClick={() => act({ action: "link" }, (r) => onLink({ ...(r.link as { url: string; expiresAt: string }), for: u.name }))}>
            {t("admin.action.link")}
          </button>
        )}
        {u.status !== "disabled" && (
          <button className={btn} data-testid="toggle-totp-required" onClick={() => act({ action: u.totpRequired ? "unrequireTotp" : "requireTotp" })}>
            {t(u.totpRequired ? "admin.action.unrequireTotp" : "admin.action.requireTotp")}
          </button>
        )}
        {(u.totpEnabled || u.passkeyCount > 0) && (
          <button className={btn} data-testid="reset-totp" onClick={async () => (await ask(t("admin.confirmResetTotp"))) && act({ action: "resetTotp" })}>
            {t("admin.action.resetTotp")}
          </button>
        )}
        {u.status !== "disabled" && <button className={btn} onClick={() => setPwOpen((o) => !o)}>{t("admin.action.setPassword")}</button>}
        {u.status === "disabled" ? (
          <button className={btn} onClick={() => act({ action: "enable" })}>{t("admin.action.enable")}</button>
        ) : (
          u.id !== meId && (
            <button className="btn-danger !min-h-9 !px-3" onClick={async () => (await ask(t("admin.confirmDisable"))) && act({ action: "disable" })}>
              {t("admin.action.disable")}
            </button>
          )
        )}
        {u.isAdmin ? (
          <button className={btn} onClick={() => act({ action: "removeAdmin" })}>{t("admin.action.removeAdmin")}</button>
        ) : (
          u.status !== "disabled" && <button className={btn} onClick={() => act({ action: "makeAdmin" })}>{t("admin.action.makeAdmin")}</button>
        )}
      </div>
      {pwOpen && (
        <div className="flex flex-col gap-2 border-t border-slate-200 pt-2 dark:border-slate-700">
          <PasswordField id={`pw-${u.id}`} label={t("admin.newPassword")} value={pw} onChange={setPw} identity={{ username: u.username, email: u.email }} />
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="h-5 w-5" checked={mustChange} onChange={(e) => setMustChange(e.target.checked)} />
            {t("admin.mustChange")}
          </label>
          <button
            className="btn"
            disabled={passwordIssues(pw, { username: u.username, email: u.email }).length > 0}
            onClick={() => act({ action: "setPassword", password: pw, mustChange }, () => { setPwOpen(false); setPw(""); })}
          >
            {t("admin.action.setPassword")}
          </button>
        </div>
      )}
      {dialog}
      <ErrorMessage error={error} />
    </li>
  );
}

export function UsersAdmin({ users, meId }: { users: AdminUser[]; meId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [link, setLink] = useState<LinkInfo | null>(null);
  const refresh = () => router.refresh();
  return (
    <div className="flex flex-col gap-4">
      <CreateUser
        onCreated={(l) => {
          setLink(l);
          refresh();
        }}
      />
      {link && <LinkBox link={link} />}
      <h2 className="font-semibold">{t("admin.list")}</h2>
      <ul className="flex flex-col gap-2">
        {users.map((u) => (
          <UserCard key={u.id} u={u} meId={meId} onChanged={refresh} onLink={setLink} />
        ))}
      </ul>
    </div>
  );
}
