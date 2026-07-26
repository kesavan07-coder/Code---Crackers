"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { ArrowRight, UserCheck } from "lucide-react";

export default function LoginPage() {
  const { login, updateProfile, isLoading: authLoading, user } = useAuth();
  const router = useRouter();

  const [step, setStep]                   = useState<"credentials" | "name-setup">("credentials");
  const [username, setUsername]           = useState("");
  const [password, setPassword]           = useState("");
  const [fullName, setFullName]           = useState("");
  const [error, setError]                 = useState("");
  const [submitting, setSubmitting]       = useState(false);
  const [shake, setShake]                 = useState(false);

  const handleSubmitCredentials = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);

    const result = await login(username.trim(), password, true);

    if (!result.success) {
      setError(result.error || "Login failed.");
      setSubmitting(false);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    if (result.needsNameSetup) {
      setStep("name-setup");
      setSubmitting(false);
    } else {
      const isAdmin = username.trim().toLowerCase() === "admin" || (result as any).user?.role === "admin";
      window.location.href = isAdmin ? "/admin" : "/dashboard";
    }
  };

  const handleSaveName = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    setError("");
    setSubmitting(true);

    const res = await updateProfile(fullName.trim());

    if (!res.success) {
      setError(res.error || "Failed to update profile name.");
      setSubmitting(false);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    window.location.href = user?.role === "admin" ? "/admin" : "/dashboard";
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
          x: shake ? [0, -10, 10, -8, 8, -4, 4, 0] : 0,
        }}
        transition={{
          opacity: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
          y:       { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
          scale:   { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
          x: shake ? { duration: 0.48 } : { duration: 0 },
        }}
        className="w-full max-w-md"
      >
        {step === "credentials" ? (
          <form onSubmit={handleSubmitCredentials}>
            <div className="bg-white rounded-2xl p-8 md:p-10 flex flex-col gap-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              
              {/* Header */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <img
                    src="/college_logo.png"
                    alt="Muthayammal Engineering College Logo"
                    className="w-12 h-12 object-contain rounded-xl border border-neutral-200 p-1 bg-white"
                  />
                  <div className="flex flex-col">
                    <span className="text-xl font-extrabold uppercase tracking-tight leading-none text-black">Code</span>
                    <span className="text-xl font-extrabold uppercase tracking-tight leading-none text-black -mt-1.5">Crackers</span>
                  </div>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-black leading-none mb-2">
                  Command Center
                </h1>
                <p className="text-sm font-semibold text-neutral-500">
                  Sign in with your competition credentials
                </p>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-neutral-100 text-black text-sm font-bold py-3 px-4 rounded-xl border border-black mb-4">
                      {error}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Fields */}
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label htmlFor="login-username" className="text-xs font-bold uppercase tracking-wider text-black">
                    Username
                  </label>
                  <input
                    id="login-username"
                    type="text"
                    placeholder="e.g. CC_2026_001"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full rounded-xl bg-zinc-100 px-4 py-4 text-black text-base font-semibold outline-none border-2 border-transparent focus:border-black transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="login-password" className="text-xs font-bold uppercase tracking-wider text-black">
                    Password
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded-xl bg-zinc-100 px-4 py-4 text-black text-base font-semibold tracking-widest outline-none border-2 border-transparent focus:border-black transition-colors"
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                id="login-submit-btn"
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-black rounded-xl text-white font-bold text-lg flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
              >
                {submitting ? (
                  <span className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin inline-block" />
                ) : (
                  <>
                    Sign In 
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              <p className="text-center text-xs font-semibold text-neutral-400">
                Credentials are provided by the competition organizer.
              </p>
            </div>
          </form>
        ) : (
          /* Step 2: First-Time Login Name Setup */
          <form onSubmit={handleSaveName}>
            <div className="bg-white rounded-2xl p-8 md:p-10 flex flex-col gap-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 border border-neutral-200 flex items-center justify-center text-black mb-4">
                  <UserCheck size={24} strokeWidth={2.5} />
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-black leading-tight mb-2">
                  First Login Setup
                </h1>
                <p className="text-sm font-semibold text-neutral-500">
                  Please enter your full name to complete your participant profile.
                </p>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    key="error-name"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-neutral-100 text-black text-sm font-bold py-3 px-4 rounded-xl border border-black mb-4">
                      {error}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-col gap-2">
                <label htmlFor="first-fullname" className="text-xs font-bold uppercase tracking-wider text-black">
                  Enter Your Full Name *
                </label>
                <input
                  id="first-fullname"
                  type="text"
                  placeholder="e.g. Alex Morgan"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoFocus
                  className="w-full rounded-xl bg-zinc-100 px-4 py-4 text-black text-base font-semibold outline-none border-2 border-transparent focus:border-black transition-colors"
                />
                <p className="text-[11px] text-neutral-400 font-semibold mt-1">
                  This will permanently save your name on certificates and dashboard results.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-black rounded-xl text-white font-bold text-lg flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
              >
                {submitting ? (
                  <span className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin inline-block" />
                ) : (
                  <>
                    Save &amp; Continue
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
