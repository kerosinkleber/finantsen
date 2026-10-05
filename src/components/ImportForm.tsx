"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";
import type { MessageKey } from "@/i18n";
import { ErrorMessage } from "./ErrorMessage";

type Preview = {
  format: "finantsen" | "splitwise" | "tricount" | "simple";
  expenses: number;
  payments: number;
  currencies: string[];
  errors: { line: number; code: string }[];
  alreadyImported: boolean;
  members: { id: string; name: string }[];
  people: { name: string; suggestion: string }[];
};
type Result = { expenses: number; payments: number; failed: { line: number; code: string }[] };

/** Import in drei Schritten: Datei wählen → Vorschau mit Zuordnung der Namen → Import. */
export function ImportForm({ groupId }: { groupId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [text, setText] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(f: File | undefined) {
    setPreview(null);
    setResult(null);
    setError(null);
    if (!f) return;
    setBusy(true);
    try {
      const content = await f.text();
      const p = await api<Preview>("POST", `/api/groups/${groupId}/import/preview`, { text: content });
      setText(content);
      setPreview(p);
      setMapping(Object.fromEntries(p.people.map((x) => [x.name, x.suggestion])));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await api<Result>("POST", `/api/groups/${groupId}/import`, { text, mapping }));
      setPreview(null);
      router.refresh();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const reason = (code: string) => {
    const key = `import.err.${code}` as MessageKey;
    const k2 = `err.${code}` as MessageKey;
    const tr = t(key);
    return tr !== key ? tr : t(k2) !== k2 ? t(k2) : code;
  };

  return (
    <section className="card flex flex-col gap-4" data-testid="import-form">
      <p className="muted">{t("import.help")}</p>
      <label className="label" htmlFor="import-file">{t("import.file")}</label>
      <input id="import-file" type="file" accept=".csv,text/csv,text/plain" className="input" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
      {preview && (
        <div className="flex flex-col gap-3" data-testid="import-preview">
          <p>{t("import.summary", { format: t(`import.format.${preview.format}` as MessageKey), expenses: preview.expenses, payments: preview.payments, currencies: preview.currencies.join(", ") })}</p>
          {preview.alreadyImported && <p role="alert" className="neg">{t("err.import_duplicate")}</p>}
          {preview.errors.length > 0 && (
            <details>
              <summary className="cursor-pointer neg">{t("import.skipped", { n: preview.errors.length })}</summary>
              <ul className="muted text-sm">
                {preview.errors.map((e) => <li key={e.line}>{t("import.line", { line: e.line })}: {reason(e.code)}</li>)}
              </ul>
            </details>
          )}
          <h2 className="font-semibold">{t("import.people")}</h2>
          {preview.people.map((p) => (
            <div key={p.name} className="flex items-center justify-between gap-2">
              <label htmlFor={`map-${p.name}`} className="min-w-0 truncate">{p.name}</label>
              <select id={`map-${p.name}`} className="input !w-48" value={mapping[p.name]} onChange={(e) => setMapping((m) => ({ ...m, [p.name]: e.target.value }))}>
                <option value="new">{t("import.newGuest")}</option>
                {preview.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          ))}
          <button type="button" className="btn" disabled={busy || preview.alreadyImported || preview.expenses + preview.payments === 0} onClick={run}>
            {t("import.run", { n: preview.expenses + preview.payments })}
          </button>
        </div>
      )}
      {result && (
        <div role="status" data-testid="import-result" className="flex flex-col gap-1">
          <p className="pos">{t("import.done", { expenses: result.expenses, payments: result.payments })}</p>
          {result.failed.length > 0 && (
            <ul className="muted text-sm">
              {result.failed.map((e) => <li key={e.line}>{t("import.line", { line: e.line })}: {reason(e.code)}</li>)}
            </ul>
          )}
        </div>
      )}
      <ErrorMessage error={error} />
    </section>
  );
}
