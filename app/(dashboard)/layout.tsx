"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ToastProvider } from "@/components/ui/toast";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    // Check if nexus_session cookie exists
    const cookies = document.cookie.split("; ");
    const hasSession = cookies.some((c) => c.startsWith("nexus_session="));

    if (!hasSession) {
      setIsAuthenticated(false);
      router.push("/login");
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  // Skeleton loading state while verifying auth session
  if (isAuthenticated === null) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-gradient-to-br from-[#eceff4] via-[#e8edf5] to-[#dfe6f0] dark:from-[#090c10] dark:via-[#0d1117] dark:to-[#0a0f18] antialiased p-3 gap-3 relative">
          {/* Soft ambient gradient blobs */}
          <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
            <div className="absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full bg-blue-400/[0.04] dark:bg-blue-500/[0.03] blur-3xl" />
            <div className="absolute top-1/2 -left-24 h-[400px] w-[400px] rounded-full bg-indigo-400/[0.04] dark:bg-indigo-500/[0.02] blur-3xl" />
          </div>
        {/* Sidebar Skeleton */}
        <div className="w-16 h-full bg-white dark:bg-[#12161f] rounded-[26px] border border-[#e6e9f0] dark:border-slate-800 animate-pulse flex flex-col items-center py-6 gap-6 shrink-0">
          <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="space-y-4 w-full flex flex-col items-center">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-800" />
            ))}
          </div>
        </div>

        {/* Main Content Skeleton */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden space-y-4">
          {/* Header Skeleton */}
          <div className="h-14 w-full bg-white dark:bg-[#12161f] rounded-full border border-[#e6e9f0] dark:border-slate-800 animate-pulse flex items-center justify-between px-6 shrink-0">
            <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded-full" />
            <div className="h-8 w-40 bg-slate-200 dark:bg-slate-800 rounded-full" />
          </div>

          {/* Body Skeleton */}
          <div className="flex-1 p-4 space-y-6 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 h-24 bg-white dark:bg-[#12161f] rounded-3xl border border-[#e6e9f0] dark:border-slate-800 animate-pulse p-4 space-y-2" />
              <div className="lg:col-span-8 grid grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-white dark:bg-[#12161f] rounded-3xl border border-[#e6e9f0] dark:border-slate-800 animate-pulse" />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 h-64 bg-white dark:bg-[#12161f] rounded-3xl border border-[#e6e9f0] dark:border-slate-800 animate-pulse" />
              <div className="lg:col-span-5 h-64 bg-white dark:bg-[#12161f] rounded-3xl border border-[#e6e9f0] dark:border-slate-800 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

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
