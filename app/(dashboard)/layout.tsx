import * as React from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ToastProvider } from "@/components/ui/toast";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side authentication guard using the httpOnly session cookie.
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-gradient-to-br from-[#eceff4] via-[#e8edf5] to-[#dfe6f0] dark:from-[#090c10] dark:via-[#0d1117] dark:to-[#0a0f18] text-[#0f172a] dark:text-slate-100 antialiased p-3 gap-3 relative">
          {/* Soft ambient gradient blobs */}
          <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
            <div className="absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full bg-blue-400/[0.04] dark:bg-blue-500/[0.03] blur-3xl" />
            <div className="absolute top-1/2 -left-24 h-[400px] w-[400px] rounded-full bg-indigo-400/[0.04] dark:bg-indigo-500/[0.02] blur-3xl" />
            <div className="absolute -bottom-40 right-1/3 h-[350px] w-[350px] rounded-full bg-violet-400/[0.03] dark:bg-violet-500/[0.02] blur-3xl" />
          </div>
        {/* Left Icon Sidebar */}
        <div className="relative z-10">
          <Sidebar />
        </div>

        {/* Main Right Container */}
        <div className="flex flex-1 flex-col min-w-0 relative z-10">
          <Header />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
