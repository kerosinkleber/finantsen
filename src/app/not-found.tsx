import Link from "next/link";
import { getT } from "@/i18n/server";

export default async function NotFound() {
  const { t } = await getT();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-4">
      <p>{t("err.not_found")}</p>
      <Link className="btn" href="/">{t("nav.home")}</Link>
    </main>
  );
}
