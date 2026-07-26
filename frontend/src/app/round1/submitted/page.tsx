"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";
import { CheckCircle2, Lock, ArrowRight } from "lucide-react";

export default function Round1SubmittedPage() {
  const { user, token, logout, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!token) {
      router.replace("/login");
    }
  }, [token, router]);

  if (isLoading || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-black">
      {/* Navbar */}
      <header className="w-full h-16 bg-white px-6 md:px-12 flex items-center justify-between sticky top-0 z-50 border-b border-neutral-200">
        <span className="font-extrabold text-lg uppercase tracking-tight leading-none text-black">
          Code Crackers
        </span>
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold hidden md:inline-block text-neutral-500">
            Participant: <span className="text-black font-bold">{user?.username}</span>
          </span>
          <button
            onClick={logout}
            className="text-sm font-bold uppercase tracking-wider text-black hover:text-neutral-500 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-xl bg-white border-2 border-neutral-200 rounded-3xl p-8 md:p-12 shadow-2xl flex flex-col items-center text-center gap-6"
        >
          <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center text-black border border-neutral-200 mb-2">
            <CheckCircle2 size={36} strokeWidth={2.5} />
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-black leading-tight">
            Round 1 Completed Successfully
          </h1>

          <p className="text-sm font-semibold text-neutral-500 leading-relaxed max-w-md">
            Your submission has been recorded. Please wait while the organizers evaluate the results.
          </p>

          <div className="w-full border-t border-neutral-100 my-4" />

          {/* Status Box */}
          <div className="w-full flex flex-col gap-3">
            <div className="flex items-center justify-between px-5 py-4 rounded-2xl bg-stone-50 border border-neutral-200">
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">Round Status</span>
              <span className="flex items-center gap-2 text-sm font-extrabold text-black">
                <span className="w-2 h-2 rounded-full bg-black" />
                Round 1 Completed
              </span>
            </div>

            <div className="flex items-center justify-between px-5 py-4 rounded-2xl bg-stone-50 border border-neutral-200">
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">Access</span>
              <span className="flex items-center gap-2 text-sm font-extrabold text-black">
                <Lock size={14} strokeWidth={2.5} />
                Round 1 Locked
              </span>
            </div>
          </div>

          <div className="w-full border-t border-neutral-100 my-4" />

          <button
            onClick={() => router.push("/dashboard")}
            className="w-full py-4 bg-black text-white rounded-xl font-bold text-sm tracking-wide hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            Go to Dashboard
            <ArrowRight size={16} strokeWidth={2.5} />
          </button>
        </motion.div>
      </main>
    </div>
  );
}
