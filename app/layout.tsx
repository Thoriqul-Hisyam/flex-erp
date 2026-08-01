import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteSettingsProvider } from "@/components/providers/site-settings-provider";
import { ModuleProvider } from "@/components/providers/module-provider";
import { getSessionUser } from "@/lib/auth/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flex ERP | Enterprise Management System",
  description:
    "Enterprise ERP & Inventory Control Platform built on Drizzle ORM & Next.js 16.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolve the current session user so the shared permission provider can key
  // itself to the user. Switching accounts (login/logout) changes this key and
  // forces React to remount ModuleProvider, which clears any stale permission
  // state cached from a previous session — no manual refresh needed.
  const user = await getSessionUser().catch(() => null);
  const providerKey = user?.id ?? "anon";

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#f1f5f9] dark:bg-[#0b0e14] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
        <ThemeProvider>
          <SiteSettingsProvider>
            <ModuleProvider key={providerKey}>{children}</ModuleProvider>
          </SiteSettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
