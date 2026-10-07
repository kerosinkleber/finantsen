import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getLocale } from "@/i18n/server";
import { I18nProvider } from "@/i18n/client";
import { ServiceWorkerRegister } from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: { default: "Finantsen", template: "%s · Finantsen" },
  description: "Shared expenses, self-hosted.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Finantsen", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <I18nProvider locale={locale}>{children}</I18nProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
