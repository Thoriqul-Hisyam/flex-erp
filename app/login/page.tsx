"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  X,
} from "lucide-react";
import { loginAction, LoginActionResult } from "@/app/actions/auth-actions";

// The login screen has no session/company context yet, so it always shows
// the app's own generic brand - per-company branding (name/logo) only
// applies once a user is authenticated and their company is known.
const BRAND_NAME = "Flex ERP";
const BRAND_COLOR = "#0088ff";

export default function FlexERPLoginPage() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [logoError, setLogoError] = React.useState(false);

  // Server action drives authentication (no client-side API fetch).
  const [state, formAction, isPending] = useActionState<
    LoginActionResult | null,
    FormData
  >(loginAction, null);

  const errorMessage = state?.message || null;
  const primaryColor = BRAND_COLOR;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#eceff4] dark:bg-[#090c10] p-4 sm:p-6 lg:p-8">
      <div className="flex w-full max-w-[960px] min-h-[640px] rounded-[24px] overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.06)] border border-[#e6e9f0] dark:border-slate-800">
        {/* ─── LEFT: Mascot Illustration Panel ─── */}
        <div
          className="hidden md:flex md:w-[45%] lg:w-[48%] relative rounded-[24px] m-2 overflow-hidden"
          style={{ backgroundColor: "#f0f7ff" }}
        >
          {/* Brand Logo (Top Left) */}
          <div className="absolute top-6 left-6 z-20">
            <div className="flex items-center gap-2">
              {!logoError ? (
                /* eslint-disable-next-html-element-for-img */
                <img
                  src="/logo/logo.png"
                  alt={BRAND_NAME}
                  onError={() => setLogoError(true)}
                  className="h-7 w-auto object-contain"
                />
              ) : (
                <span
                  className="text-lg font-extrabold tracking-tight"
                  style={{ color: primaryColor }}
                >
                  {BRAND_NAME}.
                </span>
              )}
            </div>
          </div>

          {/* Decorative floating elements (positioned on the left side) */}
          <div className="absolute top-16 left-8 z-10 w-16 h-20 bg-white/70 rounded-xl rotate-[-12deg] shadow-sm flex flex-col items-center justify-center gap-1.5 p-2">
            <div className="w-8 h-1.5 bg-[#0088ff]/20 rounded-full" />
            <div className="w-10 h-8 bg-[#0088ff]/10 rounded-sm" />
            <div className="w-6 h-1 bg-[#0088ff]/15 rounded-full" />
          </div>

          <div className="absolute bottom-32 left-8 z-10 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#0088ff]/30" />
            <div className="flex flex-col gap-1.5">
              <div className="w-12 h-2 bg-[#0088ff]/20 rounded-full" />
              <div className="w-16 h-2 bg-[#0088ff]/15 rounded-full" />
            </div>
          </div>

          {/* Mascot Image — 2x Larger Scale in Bottom-Right Corner */}
          <div className="absolute right-0 bottom-0 h-full w-full overflow-hidden pointer-events-none select-none z-10 flex items-end justify-end">
            <img
              src="/images/assets/login-assets.avif"
              alt={`${BRAND_NAME} Mascot`}
              className="h-[90%] w-auto object-contain object-right-bottom scale-[1.85] origin-bottom-right translate-x-[95%] translate-y-[2%]"
            />
          </div>
        </div>

        {/* ─── RIGHT: Login Form Panel ─── */}
        <div className="w-full md:w-[55%] lg:w-[52%] bg-white dark:bg-[#12161f] flex flex-col justify-center items-center px-8 sm:px-12 lg:px-16 py-10 relative">
          {/* Close button (top right, decorative) */}
          <button className="absolute top-5 right-5 text-[#8a94a6] hover:text-[#0f172a] dark:hover:text-white transition-colors">
            <X className="h-6 w-6" />
          </button>

          <div className="w-full max-w-sm space-y-7">
            {/* Mobile-only brand */}
            <div className="md:hidden flex justify-center mb-2">
              {!logoError ? (
                <img
                  src="/logo/logo.png"
                  alt={BRAND_NAME}
                  onError={() => setLogoError(true)}
                  className="h-8 w-auto object-contain"
                />
              ) : (
                <span
                  className="text-xl font-extrabold tracking-tight"
                  style={{ color: primaryColor }}
                >
                  {BRAND_NAME}.
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-3xl font-extrabold text-[#0f172a] dark:text-white text-center tracking-tight">
              Login
            </h1>

            {/* Error */}
            {errorMessage && (
              <div className="rounded-xl bg-[#ffeef0] dark:bg-rose-950/40 p-3 border border-rose-200 dark:border-rose-900 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-[#ef4444] shrink-0 mt-0.5" />
                <span className="text-xs font-medium text-[#ef4444] leading-relaxed">
                  {errorMessage}
                </span>
              </div>
            )}

            {/* Form — submits to the server loginAction */}
            <form action={formAction} className="space-y-5">
              {/* Email */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[#0f172a] dark:text-slate-200">
                  Email
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center border-r border-[#e6e9f0] dark:border-slate-700">
                    <Mail className="h-4 w-4 text-[#8a94a6]" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@perusahaan.co.id"
                    required
                    className="w-full pl-14 pr-4 h-12 bg-[#f8f9fc] dark:bg-slate-900 border border-[#e6e9f0] dark:border-slate-800 rounded-xl text-sm text-[#0f172a] dark:text-white placeholder:text-[#8a94a6] focus:outline-none focus:ring-2 focus:ring-[#0088ff] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[#0f172a] dark:text-slate-200">
                  Password
                </label>
                <div className="relative flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center border-r border-[#e6e9f0] dark:border-slate-700 text-[#8a94a6] hover:text-[#0088ff] transition-colors z-10"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-14 pr-4 h-12 bg-[#f8f9fc] dark:bg-slate-900 border border-[#e6e9f0] dark:border-slate-800 rounded-xl text-sm text-[#0f172a] dark:text-white placeholder:text-[#8a94a6] focus:outline-none focus:ring-2 focus:ring-[#0088ff] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isPending}
                className="w-full h-12 rounded-xl text-white font-bold text-sm cursor-pointer transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2 mt-2"
                style={{
                  backgroundColor: primaryColor,
                  boxShadow: "0 4px 14px rgba(0, 136, 255, 0.25)",
                }}
              >
                {isPending ? (
                  <div className="flex items-center justify-center gap-2.5">
                    <div className="h-4 w-4 rounded-full bg-white/30 animate-pulse" />
                    <div className="h-3.5 w-32 rounded-full bg-white/40 animate-pulse" />
                  </div>
                ) : (
                  <>
                    Masuk ke {BRAND_NAME}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
