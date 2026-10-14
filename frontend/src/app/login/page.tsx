"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { ArrowRight, UserCheck } from "lucide-react";
import { usePortal } from "@/lib/portalContext";

export default function LoginPage() {
  const { login, updateProfile, isLoading: authLoading, user } = useAuth();
  const { portalSettings } = usePortal();
  const router = useRouter();

  const [step, setStep]                   = useState<"credentials" | "name-setup">("credentials");
  const [username, setUsername]           = useState("");
  const [password, setPassword]           = useState("");
  const [fullName, setFullName]           = useState("");
  const [year, setYear]                   = useState("I Year");
  const [department, setDepartment]       = useState("CSBS");
  const [collegeName, setCollegeName]     = useState("Muthayammal Engineering College");
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

    // Determine role from the returned user object
    const loggedInRole = result.user?.role;

    // Super Admin goes to /super-admin, Admin goes to /admin
    if (loggedInRole === "super_admin") {
      window.location.href = "/super-admin";
      return;
    }
    if (loggedInRole === "admin") {
      window.location.href = "/admin";
      return;
    }

    // Participant: check if first-time profile setup is needed
    if (result.needsNameSetup) {
      setStep("name-setup");
      setSubmitting(false);
    } else {
      window.location.href = "/dashboard";
    }
  };

  const handleSaveName = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!department.trim()) {
      setError("Please enter your department.");
      return;
    }
    if (!collegeName.trim()) {
      setError("Please enter your college name.");
      return;
    }
    setError("");
    setSubmitting(true);

    const res = await updateProfile({
      fullName: fullName.trim(),
      year,
      department: department.trim(),
      collegeName: collegeName.trim(),
    });

    if (!res.success) {
      setError(res.error || "Failed to update profile.");
      setSubmitting(false);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    window.location.href = (user?.role === "super_admin" || user?.role === "admin") ? "/admin" : "/dashboard";
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
            <div className="bg-white rounded-2xl p-5 sm:p-8 md:p-10 flex flex-col gap-6 sm:gap-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              
              {/* Header */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <img
                    src={portalSettings.collegeLogo || "/college_logo.png"}
                    alt={portalSettings.collegeName || "College Logo"}
                    className="w-12 h-12 object-contain rounded-xl border border-neutral-200 p-1 bg-white"
                  />
                  <div className="flex flex-col">
                    <span className="text-xl font-extrabold uppercase tracking-tight leading-none text-black">
                      {portalSettings.eventName || "Code Crackers"}
                    </span>
                  </div>
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-black leading-none mb-2">
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
                className="w-full py-3.5 sm:py-4 bg-black rounded-xl text-white font-bold text-base sm:text-lg flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
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
            <div className="bg-white rounded-2xl p-5 sm:p-8 md:p-10 flex flex-col gap-6 sm:gap-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 border border-neutral-200 flex items-center justify-center text-black mb-4">
                  <UserCheck size={24} strokeWidth={2.5} />
                </div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-black leading-tight mb-2">
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

              <div className="flex flex-col gap-5">
                {/* Full Name */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="first-fullname" className="text-xs font-bold uppercase tracking-wider text-black">
                    Full Name *
                  </label>
                  <input
                    id="first-fullname"
                    type="text"
                    placeholder="e.g. Alex Morgan"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    autoFocus
                    className="w-full rounded-xl bg-zinc-100 px-4 py-3.5 text-black text-sm font-semibold outline-none border-2 border-transparent focus:border-black transition-colors"
                  />
                </div>

                {/* Year */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-black">
                    Year of Study *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {["I Year", "II Year", "III Year", "IV Year"].map((yr) => (
                      <label
                        key={yr}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 cursor-pointer text-xs font-bold transition-colors ${
                          year === yr ? "border-black bg-black text-white" : "border-neutral-200 bg-zinc-50 text-neutral-600 hover:border-neutral-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="participant-year"
                          value={yr}
                          checked={year === yr}
                          onChange={(e) => setYear(e.target.value)}
                          className="sr-only"
                        />
                        <span>{yr}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Department */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="first-dept" className="text-xs font-bold uppercase tracking-wider text-black">
                    Department *
                  </label>
                  <input
                    id="first-dept"
                    type="text"
                    placeholder="e.g. CSBS, CSE, IT, ECE"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    required
                    className="w-full rounded-xl bg-zinc-100 px-4 py-3.5 text-black text-sm font-semibold outline-none border-2 border-transparent focus:border-black transition-colors"
                  />
                </div>

                {/* College Name */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="first-college" className="text-xs font-bold uppercase tracking-wider text-black">
                    College Name *
                  </label>
                  <input
                    id="first-college"
                    type="text"
                    placeholder="e.g. Muthayammal Engineering College"
                    value={collegeName}
                    onChange={(e) => setCollegeName(e.target.value)}
                    required
                    className="w-full rounded-xl bg-zinc-100 px-4 py-3.5 text-black text-sm font-semibold outline-none border-2 border-transparent focus:border-black transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 sm:py-4 bg-black rounded-xl text-white font-bold text-base sm:text-lg flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
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
