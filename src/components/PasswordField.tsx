"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { PASSWORD_ISSUES, passwordIssues } from "@/lib/password";
import type { MessageKey } from "@/i18n";

/** Passwortfeld mit Live-Checkliste der Richtlinie (dieselbe Prüfung wie auf dem Server). */
export function PasswordField({ id, label, value, onChange, identity, autoComplete = "new-password", showRules = true }: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  identity?: { username?: string | null; email?: string | null };
  autoComplete?: string;
  showRules?: boolean;
}) {
  const { t } = useI18n();
  const [shown, setShown] = useState(false);
  const issues = passwordIssues(value, identity);
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="flex gap-2">
        <input
          id={id}
          type={shown ? "text" : "password"}
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          spellCheck={false}
          autoCapitalize="none"
        />
        <button type="button" className="btn-secondary" onClick={() => setShown((s) => !s)} aria-pressed={shown}>
          {shown ? t("pw.hide") : t("pw.show")}
        </button>
      </div>
      {showRules && (
        <ul className="mt-2 grid gap-1 text-sm" data-testid="pw-rules" aria-live="polite">
          {PASSWORD_ISSUES.map((rule) => {
            const ok = value !== "" && !issues.includes(rule);
            return (
              <li key={rule} data-rule={rule} data-ok={ok} className={ok ? "pos" : "muted"}>
                <span aria-hidden>{ok ? "✓" : "○"}</span> {t(`pw.rule.${rule}` as MessageKey)}
                {rule === "too_short" && <span className="muted"> · {t("pw.counter", { n: Array.from(value).length })}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
