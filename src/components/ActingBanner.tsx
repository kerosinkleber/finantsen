"use client";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { useI18n } from "@/i18n/client";

/** Dauerhafter Hinweis, solange der Admin als Testnutzer handelt. */
export function ActingBanner({ testUserId, name }: { testUserId: string; name: string }) {
  const { t } = useI18n();
  const router = useRouter();
  async function stop() {
    await api("DELETE", "/api/admin/act");
    router.push(`/admin/test-users/${testUserId}`);
    router.refresh();
  }
  return (
    <div
      className="sticky top-0 z-20 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-2 bg-amber-400 px-4 py-2 text-sm font-medium text-amber-950"
      role="status"
      data-testid="acting-banner"
    >
      <span>{t("test.actingBanner", { name })}</span>
      <button className="rounded-lg bg-amber-950 px-3 py-1.5 text-amber-50" onClick={stop}>{t("test.backToAdmin")}</button>
    </div>
  );
}
