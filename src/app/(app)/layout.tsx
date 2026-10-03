import Link from "next/link";
import { requireUser } from "@/server/auth";
import { Nav } from "@/components/Nav";
import { OfflineBanner } from "@/components/OfflineBanner";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="mx-auto min-h-dvh w-full max-w-3xl px-4 pb-24 pt-4 md:pb-8">
      <header className="mb-4 flex items-center justify-between gap-4">
        <Link href="/" className="text-xl font-bold text-brand">Finantsen</Link>
        <div className="hidden md:block"><Nav /></div>
      </header>
      <OfflineBanner />
      <main className="flex flex-col gap-4">{children}</main>
      <div className="md:hidden"><Nav /></div>
    </div>
  );
}
