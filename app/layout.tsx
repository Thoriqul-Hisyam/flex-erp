import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteSettingsProvider } from "@/components/providers/site-settings-provider";
import { ModuleProvider } from "@/components/providers/module-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flex ERP | Enterprise Management System",
  description: "Enterprise ERP & Inventory Control Platform built on Drizzle ORM & Next.js 16.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#f1f5f9] dark:bg-[#0b0e14] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
        <ThemeProvider>
          <SiteSettingsProvider>
            <ModuleProvider>{children}</ModuleProvider>
          </SiteSettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
